import chokidar from "chokidar"
import path from "node:path"
import fs from "node:fs"
import { extractMetadata } from "./scanner.js"
import { sha256File } from "./downloader.js"
import { promoteLocationOrDeleteTrack, mergeTrackIntoCanonical, serialized } from "./trackDedupe.js"
import {
  GET_FOLDER_PATHS,
  INSERT_ARTIST_IF_NOT_EXISTS,
  GET_ARTIST_BY_NAME,
  UPDATE_ARTIST_COVER,
  GET_TRACK_BY_PATH,
  GET_TRACK_BY_HASH,
  GET_OTHER_TRACK_BY_HASH,
  UPDATE_TRACK_HASH,
  INSERT_TRACK_LOCATION,
  UPSERT_TRACK,
  GET_LOCATION_BY_PATH,
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
  const getTrackByPath = db.prepare(GET_TRACK_BY_PATH)
  const getTrackByHash = db.prepare(GET_TRACK_BY_HASH)
  const getOtherTrackByHash = db.prepare(GET_OTHER_TRACK_BY_HASH)
  const updateTrackHash = db.prepare(UPDATE_TRACK_HASH)
  const insertTrackLocation = db.prepare(INSERT_TRACK_LOCATION)
  const getLocationByPath = db.prepare(GET_LOCATION_BY_PATH)

  watcher
    .on("add", async (filePath) => {
      if (!/\.(mp3|flac|wav|m4a|ogg)$/i.test(path.extname(filePath))) return
      const folderPath = path.dirname(filePath)
      const folderId = db
        .prepare("SELECT id FROM folders WHERE path=?")
        .get(folderPath)?.id
      if (!folderId) return

      let fileSize = null
      try {
        fileSize = fs.statSync(filePath).size
      } catch (statErr) {
        log.warn("watchFolders :: stat failed:", filePath, "::", statErr.message)
        return
      }

      // Everything from here on (hash check through the eventual write) runs
      // one file at a time process-wide - chokidar fires "add" for every file
      // without waiting on the previous handler, so this is what stops two
      // identical-content files from racing each other. See serialized()'s comment.
      await serialized(async () => {
        // Already recorded as a secondary copy of some other track (e.g. one
        // merged in by mergeMetadataDuplicates) - chokidar's ignoreInitial:false
        // re-fires "add" for it on every watchFolders() restart, and its content
        // hash won't match the canonical track it belongs to, so without this
        // check it would fall through below and get re-inserted as a fresh
        // duplicate, undoing the merge.
        if (getLocationByPath.get(filePath)) return

        const existingByPath = getTrackByPath.get(filePath)

        // Fast path: already known, already hashed, unchanged size - nothing to do.
        if (existingByPath && existingByPath.content_hash && existingByPath.file_size === fileSize) {
          return
        }

        try {
          const hash = await sha256File(filePath)

          if (existingByPath) {
            const other = getOtherTrackByHash.get(hash, existingByPath.id)
            if (other) {
              // Same content hash as a different track - a legacy duplicate
              // from before content hashing existed. Merge into the earlier row.
              const [canonical, duplicate] =
                existingByPath.id < other.id ? [existingByPath, other] : [other, existingByPath]
              mergeTrackIntoCanonical(db, canonical, duplicate)
              return
            }
            if (existingByPath.file_size === fileSize) {
              // Only the hash was missing (legacy backfill) - nothing else changed.
              updateTrackHash.run(hash, filePath)
              return
            }
            // else: content changed in place, fall through to reparse below
          } else {
            const trackWithSameHash = getTrackByHash.get(hash)
            if (trackWithSameHash) {
              // Same song already tracked under a different path - record as a
              // location instead of creating a duplicate tracks row.
              insertTrackLocation.run(trackWithSameHash.id, folderId, filePath, fileSize)
              return
            }
          }

          const meta = await extractMetadata(filePath)
          if (!meta) return

          const artistName = meta.artist || "Unknown Artist"

          insertArtist.run(artistName)
          const artistRow = getArtist.get(artistName)
          const artistId = artistRow?.id || null

          if (!artistRow.cover && meta.cover) {
            updateArtistCover.run(meta.cover, artistId)
          }

          db.prepare(UPSERT_TRACK).run(
            folderId,
            artistId,
            filePath,
            meta.title || path.basename(filePath),
            meta.album || "",
            artistName,
            meta.duration || 0,
            meta.cover || null,
            fileSize,
            hash
          )
        } catch (err) {
          log.warn("watchFolders :: Metadata extraction failed:", filePath, "::", err.message)
        }
      })
    })
    .on("unlink", (filePath) => {
      promoteLocationOrDeleteTrack(db, filePath)
    })
  log.info("watchFolders :: End")
}
