import { ipcMain } from "electron"
import fs from "fs"
import path from "path"
import { parseFile } from "music-metadata"
import { extractEmbeddedLyrics } from "../utils/embeddedLyrics.js"
import { parseLrc, withEndTimes } from "../utils/lrcParser.js"
import { fetchLyricsFromLrclib } from "../utils/lrclibClient.js"
import { GET_TRACKS, GET_LIKED_TRACKS, UPDATE_LIKE } from "../db/queries.js"
import log from "../../logger.js"

// Tracks file_path -> true for lookups that returned no online match this session
const onlineLookupMisses = new Set()

function formatLrcTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = (seconds % 60).toFixed(2).padStart(5, "0")
  return `${mm}:${ss}`
}

export function registerTrackHandlers(mainWindow, db) {
  // tracks
  ipcMain.handle("tracks:get-tracks", () => db.prepare(GET_TRACKS).all())

  // liked
  ipcMain.handle("tracks:get-liked-tracks", () =>
    db.prepare(GET_LIKED_TRACKS).all()
  )

  // like a track
  ipcMain.handle("tracks:updateLike", (event, trackId, isLiked) => {
    const result = db.prepare(UPDATE_LIKE).run(isLiked ? 1 : 0, trackId)
    return result.changes > 0
  })

  // lyrics
  ipcMain.handle("tracks:get-lyrics", async (event, filePath, options = {}) => {
    const empty = { text: null, timestamps: null, synchronized: false, source: null }
    const fetchOnline = options.fetchOnline !== false

    try {
      const { dir, name } = path.parse(filePath)
      const lrcPath = path.join(dir, `${name}.lrc`)
      if (fs.existsSync(lrcPath)) {
        const lrcResult = parseLrc(fs.readFileSync(lrcPath, "utf-8"))
        if (lrcResult) {
          log.info("lyrics :: .lrc file :: hit", filePath)
          return { ...lrcResult, source: "lrc" }
        }
      }
      log.info("lyrics :: .lrc file :: miss", filePath)

      const metadata = await parseFile(filePath)
      const embedded = extractEmbeddedLyrics(metadata)
      if (embedded) {
        log.info("lyrics :: embedded tags :: hit", filePath)
        // embedded.timestamps (SYLT) is { time, text } — normalize to the
        // same { startTime, endTime, text } shape every other source uses.
        const timestamps = embedded.timestamps
          ? withEndTimes(
              embedded.timestamps.map((t) => ({ startTime: t.time, text: t.text }))
            )
          : null
        return {
          text: embedded.text,
          timestamps,
          synchronized: !!embedded.synchronized,
          source: "embedded",
        }
      }
      log.info("lyrics :: embedded tags :: miss", filePath)

      if (fetchOnline && !onlineLookupMisses.has(filePath)) {
        const { lyrics: online, reason } = await fetchLyricsFromLrclib({
          artist: metadata.common?.artist,
          title: metadata.common?.title,
          album: metadata.common?.album,
          duration: metadata.format?.duration,
        })

        if (online) {
          log.info("lyrics :: online lookup :: hit", filePath)
          try {
            fs.writeFileSync(
              lrcPath,
              online.timestamps
                .map((t) => `[${formatLrcTime(t.startTime)}]${t.text}`)
                .join("\n")
            )
          } catch (writeErr) {
            console.error("Failed to write .lrc file:", writeErr)
          }
          return { ...online, source: "online" }
        }

        log.info(`lyrics :: online lookup :: miss (${reason})`, filePath)
        onlineLookupMisses.add(filePath)
        return { ...empty, reason }
      } else if (!fetchOnline) {
        log.info("lyrics :: online lookup :: skipped (setting disabled)", filePath)
      }

      return empty
    } catch (err) {
      console.error("Failed to read lyrics:", err)
      return empty
    }
  })
}
