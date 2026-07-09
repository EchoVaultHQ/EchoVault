import { app, BrowserWindow, protocol } from "electron"
import path from "node:path"
import fs from "node:fs"
import { Readable } from "node:stream"
import started from "electron-squirrel-startup"
import log from "electron-log/main"
import { initDB } from "./backend/db/index.js"
import { registerAllHandlers } from "./backend/main/ipcHandlers.js"

// logger init
log.initialize()
log.transports.file.level = "info"
log.transports.console.level = "debug"
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}"
log.transports.file.maxSize = 5 * 1024 * 1024

if (started) app.quit()

let mainWindow

// MUST be before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: "echovault",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: false,
    },
  },
  {
    scheme: "echovault-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: false,
    },
  },
])

function createWindow() {
  const isDev = !app.isPackaged
  const isMac = process.platform === "darwin"

  mainWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icons", "app-icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // webSecurity stays true (default)
      devTools: isDev,
    },
    center: true,
    height: 700,
    width: 1280,
    minWidth: 350,
    minHeight: 634,
    // macOS keeps the native traffic lights (frame:false hides them);
    // Windows/Linux keep the fully custom frameless title bar.
    ...(isMac
      ? { titleBarStyle: "hidden", trafficLightPosition: { x: 12, y: 10 } }
      : { titleBarStyle: "hidden", frame: false }),
  })

  mainWindow.once("ready-to-show", () => {
    // mainWindow.maximize()
    mainWindow.show()
    log.info("main :: Main window shown")

    // force close devTools if somehow opened
    if (!isDev && mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    }
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    log.info(`main :: Loading dev server: ${MAIN_WINDOW_VITE_DEV_SERVER_URL}`)
  } else {
    const indexPath = path.join(
      __dirname,
      `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
    )
    mainWindow.loadFile(indexPath)
    log.info(`main :: Loading production file: ${indexPath}`)
  }

  if (!isDev) {
    mainWindow.webContents.on("devtools-opened", () => {
      mainWindow.webContents.closeDevTools()
      log.warn("main :: DevTools opened in production - closing")
    })
  }
}

app.whenReady().then(() => {
  log.info("main :: Registering echovault protocol...")

  protocol.registerBufferProtocol("echovault", (request, callback) => {
    try {
      let filePath = request.url.substring(11)

      const wslMatch = filePath.match(/^\/([A-Za-z])\/(.*)$/)
      if (wslMatch) {
        filePath = `${wslMatch[1].toUpperCase()}:/${wslMatch[2]}`
      }

      filePath = path.normalize(filePath)
      filePath = decodeURIComponent(filePath)

      if (!fs.existsSync(filePath)) {
        log.error(`main :: File not found: ${filePath}`)
        return callback({ error: -6 })
      }

      const data = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()

      const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      }

      callback({
        mimeType: mimeTypes[ext] || "image/jpeg",
        data: data,
      })
    } catch (err) {
      log.error("main :: [echovault] Protocol error:", err)
      callback({ error: -2 })
    }
  })

  // Streams local audio files straight to <audio> for playback, so the
  // renderer never has to read/decode a whole track into memory up front.
  // Uses a fixed "local" host segment (echovault-audio://local/<encoded>,
  // see toStreamUrl in player.js) rather than an empty authority - protocol
  // .handle builds a real WHATWG URL/Request internally, which is stricter
  // about empty hosts on "standard" schemes than the legacy
  // registerBufferProtocol API the echovault:// cover-art protocol above
  // uses, so this avoids relying on that leniency.
  const AUDIO_MIME_TYPES = {
    ".flac": "audio/flac",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
  }

  protocol.handle("echovault-audio", (request) => {
    const prefix = "echovault-audio://local/"
    const encoded = request.url.startsWith(prefix)
      ? request.url.slice(prefix.length)
      : request.url.slice("echovault-audio://".length).replace(/^\/?local\//, "")
    const filePath = decodeURIComponent(encoded)

    if (!fs.existsSync(filePath)) {
      log.error(`main :: [echovault-audio] File not found: ${filePath}`)
      return new Response("Not found", { status: 404 })
    }

    const fileSize = fs.statSync(filePath).size
    const contentType =
      AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream"

    // Seeking depends on the browser sending a byte-range Range request and
    // getting back a real 206 Partial Content response - without explicit
    // handling here, every seek would just re-fetch (and replay) the whole
    // file from byte 0.
    const headers = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*", // <audio> uses crossOrigin="anonymous" so its samples are AnalyserNode-readable
    }

    const rangeHeader = request.headers.get("range")
    if (!rangeHeader) {
      const stream = Readable.toWeb(fs.createReadStream(filePath))
      return new Response(stream, {
        status: 200,
        headers: { ...headers, "Content-Length": String(fileSize) },
      })
    }

    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/)
    let start = match?.[1] ? parseInt(match[1], 10) : 0
    let end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1
    if (isNaN(start) || start < 0) start = 0
    if (isNaN(end) || end >= fileSize) end = fileSize - 1

    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${fileSize}` },
      })
    }

    const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end }))
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(end - start + 1),
      },
    })
  })

  const db = initDB()
  createWindow()
  registerAllHandlers(mainWindow, db)
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    log.info("main :: All windows closed - quitting app")
    app.quit()
  }
})

app.on("before-quit", () => {
  log.info("main :: App quitting")
})
