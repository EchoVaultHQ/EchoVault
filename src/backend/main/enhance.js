import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { dialog, ipcMain } from "electron"
import { extractMetadata } from "./scanner.js"
import { checkReady, ensureEnhancerAssets } from "./downloader.js"
import {
  GET_TRACK_BY_ID,
  GET_TRACK_BY_PATH,
  INSERT_ARTIST_IF_NOT_EXISTS,
  GET_ARTIST_BY_NAME,
  UPSERT_TRACK,
} from "../db/queries.js"
import log from "../../logger.js"

const ENHANCED_SUFFIX = " (Enhanced)"

/** Maps inference.py's ERROR <CODE> to a user-facing message. */
const ERROR_MESSAGES = {
  MODEL_NOT_FOUND: "Enhancement model files are missing or corrupt.",
  INPUT_READ_FAILED: "Could not read the source audio file.",
  ORT_INIT_FAILED: "The enhancement engine failed to start on this machine.",
  GENERIC: "Enhancement failed unexpectedly.",
}

function enhancedOutputPath(srcPath) {
  const dir = path.dirname(srcPath)
  const base = path.basename(srcPath, path.extname(srcPath))
  return path.join(dir, `${base}${ENHANCED_SUFFIX}.flac`)
}

/**
 * Runs the frozen inference binary on one file, parsing its stdout/stderr contract:
 *   stdout  PROGRESS <0-100> | DONE <path>
 *   stderr  ERROR <CODE> <message>
 * onProgress(pct) is called per PROGRESS line.
 */
function runInference({ binaryPath, modelPath, configPath, input, output }, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binaryPath,
      ["--model", modelPath, "--config", configPath, "--input", input, "--output", output, "--provider", "auto"],
      { windowsHide: true }
    )

    let stdoutBuf = ""
    let stderrTail = ""
    let errorCode = null

    child.stdout.on("data", (data) => {
      stdoutBuf += data.toString()
      let idx
      while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, idx).trim()
        stdoutBuf = stdoutBuf.slice(idx + 1)
        if (line.startsWith("PROGRESS ")) {
          const pct = parseInt(line.slice(9), 10)
          if (!Number.isNaN(pct)) onProgress(pct)
        }
        // DONE is confirmed via exit code below.
      }
    })

    child.stderr.on("data", (data) => {
      const text = data.toString()
      stderrTail = (stderrTail + text).slice(-2000)
      const match = text.match(/ERROR\s+(\w+)/)
      if (match) errorCode = match[1]
    })

    child.on("error", (err) => reject(new Error(`failed to launch enhancer: ${err.message}`)))

    child.on("close", (code) => {
      if (code === 0) return resolve()
      const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.GENERIC
      log.error(`enhance :: inference exited ${code} (${errorCode}) :: ${stderrTail}`)
      reject(new Error(message))
    })
  })
}

/**
 * Inserts the enhanced FLAC as a new track under the source track's folder,
 * reusing the scanner's metadata + upsert path. Returns the new track row.
 */
async function addEnhancedTrack(db, sourceTrack, flacPath) {
  const meta = (await extractMetadata(flacPath)) || {}
  const artistName = meta.artist || sourceTrack.artist || "Unknown Artist"

  db.prepare(INSERT_ARTIST_IF_NOT_EXISTS).run(artistName)
  const artistRow = db.prepare(GET_ARTIST_BY_NAME).get(artistName)
  const artistId = artistRow?.id || null

  const baseTitle = meta.title || sourceTrack.title || path.basename(flacPath)
  const title = baseTitle.endsWith(ENHANCED_SUFFIX) ? baseTitle : `${baseTitle}${ENHANCED_SUFFIX}`

  db.prepare(UPSERT_TRACK).run(
    sourceTrack.folder_id,
    artistId,
    flacPath,
    title,
    meta.album || sourceTrack.album || "",
    artistName,
    meta.duration || 0,
    meta.cover || null
  )

  return db.prepare(GET_TRACK_BY_PATH).get(flacPath)
}

export function registerEnhanceHandlers(mainWindow, db) {
  const send = (channel, payload) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  }

  ipcMain.handle("enhance:track", async (_event, trackId) => {
    const track = db.prepare(GET_TRACK_BY_ID).get(trackId)
    if (!track) return { success: false, error: "Track not found." }

    const outputPath = enhancedOutputPath(track.file_path)

    // Already enhanced (file on disk + row in DB) — nothing to do.
    if (fs.existsSync(outputPath) && db.prepare(GET_TRACK_BY_PATH).get(outputPath)) {
      return { success: false, error: "This track has already been enhanced." }
    }

    try {
      // First-run prompt: only when assets are actually missing.
      const status = await checkReady()
      if (!status.ready) {
        const mb = status.totalBytes ? Math.round(status.totalBytes / 1e6) : null
        const detail = mb
          ? `EchoVault needs a one-time ${mb} MB download (AI model + engine) to enhance audio.`
          : "EchoVault needs a one-time download (AI model + engine) to enhance audio."
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: "question",
          buttons: ["Cancel", "Download"],
          defaultId: 1,
          cancelId: 0,
          title: "Download enhancer",
          message: "Enable AI audio enhancement?",
          detail,
        })
        if (response !== 1) return { success: false, canceled: true }
      }

      const paths = await ensureEnhancerAssets((p) =>
        send("enhance:progress", { trackId, phase: p.phase, pct: p.pct, message: p.message })
      )

      send("enhance:progress", { trackId, phase: "enhance", pct: 0, message: "Enhancing…" })
      await runInference(
        {
          binaryPath: paths.binaryPath,
          modelPath: paths.modelPath,
          configPath: paths.configPath,
          input: track.file_path,
          output: outputPath,
        },
        (pct) => send("enhance:progress", { trackId, phase: "enhance", pct, message: "Enhancing…" })
      )

      const newTrack = await addEnhancedTrack(db, track, outputPath)
      send("enhance:done", { trackId, newTrack })
      return { success: true, newTrack }
    } catch (err) {
      log.error("enhance :: failed :: ", err.message)
      // Don't leave a half-written flac behind.
      fs.rmSync(outputPath, { force: true })
      send("enhance:error", { trackId, error: err.message })
      return { success: false, error: err.message }
    }
  })

  // Lets the renderer tailor copy (e.g. skip a spinner) when assets are already cached.
  ipcMain.handle("enhance:check-ready", async () => {
    try {
      return await checkReady()
    } catch (err) {
      log.error("enhance :: check-ready failed :: ", err.message)
      return { ready: false, totalBytes: 0, items: [] }
    }
  })
}
