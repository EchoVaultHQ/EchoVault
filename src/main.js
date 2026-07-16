import { app, BrowserWindow, protocol, shell } from "electron"
import path from "node:path"
import fs from "node:fs"
import { Readable } from "node:stream"
import started from "electron-squirrel-startup"
import log from "electron-log/main"
import { initDB } from "./backend/db/index.js"
import { registerAllHandlers } from "./backend/main/ipcHandlers.js"
import { watchFolders } from "./backend/main/watcher.js"
import { mergeMetadataDuplicates } from "./backend/main/trackDedupe.js"
import { destroyTray } from "./backend/main/tray.js"
import { parseRange } from "./backend/utils/httpRange.js"

// Packaged builds (esp. AppImage) often run with no attached stdout consumer;
// writing to a closed pipe throws an uncaught EPIPE that crashes the main
// process. Swallow it here instead of letting it kill the app.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (err) => {
    if (err.code !== "EPIPE") throw err
  })
}

// logger init
log.initialize()
log.transports.file.level = "info"
// No console consumer in packaged builds - avoid EPIPE crashes from writing
// to a stdout pipe nothing is reading. File transport still captures logs.
log.transports.console.level = app.isPackaged ? false : "debug"
log.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}"
log.transports.file.maxSize = 5 * 1024 * 1024

if (started) app.quit()

let mainWindow
let isQuitting = false

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

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Open target="_blank" / window.open navigations in the OS browser
  // instead of spawning an in-app popup window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol: urlProtocol } = new URL(url)
      if (urlProtocol === "http:" || urlProtocol === "https:") {
        shell.openExternal(url)
      }
    } catch {
      log.warn(`main :: blocked window.open for invalid URL: ${url}`)
    }
    return { action: "deny" }
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
    const range = parseRange(rangeHeader, fileSize)

    if (range.status === 416) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${fileSize}` },
      })
    }

    if (range.status === 200) {
      const stream = Readable.toWeb(fs.createReadStream(filePath))
      return new Response(stream, {
        status: 200,
        headers: { ...headers, "Content-Length": String(fileSize) },
      })
    }

    const stream = Readable.toWeb(fs.createReadStream(filePath, { start: range.start, end: range.end }))
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    })
  })

  const db = initDB()
  createWindow()
  registerAllHandlers(mainWindow, db)
  mergeMetadataDuplicates(db)
  watchFolders(db)
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    log.info("main :: All windows closed - quitting app")
    app.quit()
  }
})

app.on("activate", () => {
  if (mainWindow) mainWindow.show()
})

app.on("before-quit", () => {
  log.info("main :: App quitting")
  isQuitting = true
  destroyTray()
})
