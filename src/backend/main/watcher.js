import chokidar from "chokidar"
import path from "node:path"
import { extractMetadata } from "./scanner.js"
import {
  GET_FOLDER_PATHS,
  INSERT_ARTIST_IF_NOT_EXISTS,
  GET_ARTIST_BY_NAME,
  UPDATE_ARTIST_COVER,
  DELETE_TRACK_BY_PATH,
  UPSERT_TRACK,
} from "../db/queries.js"
import log from "../../logger.js"

let watcher = null

export function watchFolders(db) {
  log.info("watchFolders :: Start")
  if (watcher) watcher.close()

  const folders = db
    .prepare(GET_FOLDER_PATHS)
    .all()
    .map((f) => f.path)

  log.info("watchFolders watching these folders:", folders)

  // watch folders
  watcher = chokidar.watch(folders, { ignoreInitial: false })

  const insertArtist = db.prepare(INSERT_ARTIST_IF_NOT_EXISTS)
  const getArtist = db.prepare(GET_ARTIST_BY_NAME)
  const updateArtistCover = db.prepare(UPDATE_ARTIST_COVER)

  watcher
    .on("add", async (filePath) => {
      if (!/\.(mp3|flac|wav|m4a|ogg)$/i.test(path.extname(filePath))) return
      const folderPath = path.dirname(filePath)
      const folderId = db
        .prepare("SELECT id FROM folders WHERE path=?")
        .get(folderPath)?.id
      if (!folderId) return

      try {
        const meta = await extractMetadata(filePath)
        if (!meta) return

        const artistName = meta.artist || "Unknown Artist"

        insertArtist.run(artistName)
        const artistRow = getArtist.get(artistName)
        const artistId = artistRow?.id || null

        if (!artistRow.cover && meta.cover) {
          updateArtistCover.run(meta.cover, artistId)
        }

        // check for existing track
        db.prepare(UPSERT_TRACK).run(
          folderId,
          artistId,
          filePath,
          meta.title || path.basename(filePath),
          meta.album || "",
          artistName,
          meta.duration || 0,
          meta.cover || null
        )
      } catch (err) {
        log.warn("watchFolders :: Metadata extraction failed:", filePath, "::", err.message)
      }
    })
    .on("unlink", (filePath) => {
      db.prepare(DELETE_TRACK_BY_PATH).run(filePath)
    })
  log.info("watchFolders :: End")
}
