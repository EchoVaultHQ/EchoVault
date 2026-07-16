import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { parseAudioFile } from "../utils/audioMeta.js"
import { sha256File } from "./downloader.js"
import { promoteLocationOrDeleteTrack, mergeTrackIntoCanonical, serialized } from "./trackDedupe.js"
import {
  INSERT_FOLDER_IF_NOT_EXISTS,
  GET_FOLDER_ID_BY_PATH,
  GET_TRACK_PATHS_BY_FOLDER,
  INSERT_ARTIST_IF_NOT_EXISTS,
  GET_ARTIST_BY_NAME,
  UPDATE_ARTIST_COVER,
  GET_TRACK_BY_PATH,
  GET_TRACK_BY_HASH,
  GET_OTHER_TRACK_BY_HASH,
  UPDATE_TRACK_HASH,
  INSERT_TRACK_LOCATION,
  UPSERT_TRACK,
  UPDATE_FOLDER_LAST_SCANNED,
  GET_LOCATION_BY_PATH,
} from "../db/queries.js"
import log from "../../logger.js"

/**
 * Extracts metadata and writes cover image if embedded.
 */
export async function extractMetadata(filePath) {
  try {
    // log.info("extractMetadata :: Start")
    const metadata = await parseAudioFile(filePath)
    // log.info("extractMetadata :: metadata parsed")
    const { common, format } = metadata

    let coverPath = null
    if (common.picture && common.picture[0]) {
      const img = common.picture[0]
      const coverDir = path.join(app.getPath("userData"), "covers")
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir)
      coverPath = path.join(coverDir, path.basename(filePath) + ".jpg")
      fs.writeFileSync(coverPath, img.data)
    }
    // log.info("extractMetadata :: coverPath :: End", coverPath)

    return {
      title: common.title || path.basename(filePath),
      artist: common.artist || "Unknown",
      album: common.album || "Unknown",
      duration: format.duration || 0,
      cover: coverPath,
    }
  } catch (err) {
    log.warn("extractMetadata :: failed to parse", filePath, "::", err.message)
    return null
  }
}

/**
 * Scans a folder, extracts track metadata, and updates the DB.
 * TODO: Make this recursive to scan subfolders
 */

const AUDIO_EXTENSIONS_RE = /\.(mp3|flac|m4a|wav|ogg|aac)$/i

function getFoldersRecursive(dirPath, currentLevel, maxLevel = 3, result = []) {
  if (currentLevel > maxLevel) return
  const items = fs.readdirSync(dirPath)

  for (const item of items) {
    const itemPath = path.join(dirPath, item)
    const stats = fs.statSync(itemPath)

    if (stats.isDirectory()) {
      result.push(itemPath)
      getFoldersRecursive(itemPath, currentLevel + 1, maxLevel, result)
    }
  }
  return result
}

/**
 * Cheap pre-count of matching audio files across a folder and its subfolders
 * (same depth-3 walk as scanFolder), used to give scan progress UI a known
 * total before any file is actually processed. No stat/hash/parse work.
 */
export function countAudioFiles(folderPath) {
  let folderPaths
  try {
    folderPaths = getFoldersRecursive(folderPath, 1)
    folderPaths.push(folderPath)
  } catch {
    return 0
  }
  return folderPaths.reduce((sum, dir) => {
    try {
      return sum + fs.readdirSync(dir).filter((f) => AUDIO_EXTENSIONS_RE.test(f)).length
    } catch {
      return sum
    }
  }, 0)
}

async function readTracksFromFoldersAndSetInDB(db, folderPath, onFile) {
  log.info("readTracksFromFoldersAndSetInDB :: Start :: ", folderPath)

  // Insert or get folder
  db.prepare(INSERT_FOLDER_IF_NOT_EXISTS).run(folderPath)
  const folderId = db.prepare(GET_FOLDER_ID_BY_PATH).get(folderPath).id

  // Collect audio files
  const filesOnDisk = fs
    .readdirSync(folderPath)
    .filter((f) => AUDIO_EXTENSIONS_RE.test(f))
    .map((f) => path.join(folderPath, f))

  log.info("readTracksFromFoldersAndSetInDB :: fetched all music files")

  // Remove missing tracks
  const existingTracks = db
    .prepare(GET_TRACK_PATHS_BY_FOLDER)
    .all(folderId)
    .map((t) => t.file_path)

  const missing = existingTracks.filter((f) => !filesOnDisk.includes(f))
  for (const file of missing) promoteLocationOrDeleteTrack(db, file)
  log.info(
    "readTracksFromFoldersAndSetInDB :: remove deleted music files from db :: ",
    missing
  )

  // Prepare statements
  const insertArtist = db.prepare(INSERT_ARTIST_IF_NOT_EXISTS)
  const getArtist = db.prepare(GET_ARTIST_BY_NAME)
  const updateArtistCover = db.prepare(UPDATE_ARTIST_COVER)
  const getTrackByPath = db.prepare(GET_TRACK_BY_PATH)
  const getTrackByHash = db.prepare(GET_TRACK_BY_HASH)
  const getOtherTrackByHash = db.prepare(GET_OTHER_TRACK_BY_HASH)
  const updateTrackHash = db.prepare(UPDATE_TRACK_HASH)
  const insertTrackLocation = db.prepare(INSERT_TRACK_LOCATION)
  const upsertTrack = db.prepare(UPSERT_TRACK)
  const getLocationByPath = db.prepare(GET_LOCATION_BY_PATH)

  async function parseAndUpsertTrack(filePath, hash, fileSize) {
    const metadata = await parseAudioFile(filePath)
    const { title, artist, album, picture } = metadata.common
    const duration = metadata.format.duration || 0
    const artistName = artist || "Unknown Artist"

    // Insert or get artist
    insertArtist.run(artistName)
    const artistRow = getArtist.get(artistName)
    const artistId = artistRow?.id || null

    // Handle cover
    let coverData = null
    if (picture && picture.length > 0) {
      const img = picture[0]
      const coverDir = path.join(app.getPath("userData"), "covers")
      if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir)
      const coverPath = path.join(coverDir, `${path.basename(filePath)}.jpg`)
      fs.writeFileSync(coverPath, img.data)
      coverData = coverPath
    }

    // Update artist cover if not already set
    if (!artistRow.cover && coverData) {
      updateArtistCover.run(coverData, artistId)
    }

    upsertTrack.run(
      folderId,
      artistId,
      filePath,
      title || path.basename(filePath),
      album || "",
      artistName,
      duration,
      coverData,
      fileSize,
      hash
    )
  }

  // Scan files
  log.info(
    "readTracksFromFoldersAndSetInDB :: get meta data for each music file :: START"
  )
  for (const filePath of filesOnDisk) {
    onFile?.({ filePath })

    let fileSize = null
    try {
      fileSize = fs.statSync(filePath).size
    } catch (statErr) {
      log.warn(
        "readTracksFromFoldersAndSetInDB :: stat failed for:",
        filePath,
        "::",
        statErr.message
      )
      continue
    }

    // Everything from here on (hash check through the eventual write) runs
    // one file at a time process-wide - see serialized()'s comment for why.
    await serialized(async () => {
      // Already recorded as a secondary copy of some other track (e.g. one
      // merged in by mergeMetadataDuplicates) - a rescan would otherwise treat
      // it as unseen (its hash won't match the canonical track it belongs to)
      // and re-insert it as a fresh duplicate, undoing the merge.
      if (getLocationByPath.get(filePath)) return

      const existingByPath = getTrackByPath.get(filePath)

      // Fast path: already known, already hashed, unchanged size - skip entirely.
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

          if (existingByPath.file_size !== fileSize) {
            await parseAndUpsertTrack(filePath, hash, fileSize)
          } else {
            // Only the hash was missing (legacy backfill) - nothing else changed.
            updateTrackHash.run(hash, filePath)
          }
          return
        }

        const trackWithSameHash = getTrackByHash.get(hash)
        if (trackWithSameHash) {
          // Same song already tracked under a different path - record as a
          // location instead of creating a duplicate tracks row.
          insertTrackLocation.run(trackWithSameHash.id, folderId, filePath, fileSize)
          return
        }

        await parseAndUpsertTrack(filePath, hash, fileSize)
      } catch (err) {
        log.warn(
          "readTracksFromFoldersAndSetInDB :: Metadata read failed for:",
          filePath,
          "::",
          err.message
        )
      }
    })
  }
  log.info(
    "readTracksFromFoldersAndSetInDB :: get meta data for each music file :: End"
  )

  db.prepare(UPDATE_FOLDER_LAST_SCANNED).run(folderId)

  log.info(`readTracksFromFoldersAndSetInDB :: Folder scanned: ${folderPath}`)
}

export async function scanFolder(db, folderPath, onFile) {
  log.info("scanFolder :: Scanning folder :: Start :: ", folderPath) // get all folders inside folderPath (current recursion limit is 3 levels)

  const folderPaths = getFoldersRecursive(folderPath, 1)
  // add the root folder as well as it might have songs files
  folderPaths.push(folderPath)
  log.info("scanFolder :: folderPaths :: ", folderPaths)

  const readPromises = folderPaths.map(async (path) => {
    try {
      return await readTracksFromFoldersAndSetInDB(db, path, onFile)
    } catch (error) {
      log.error(`scanFolder :: Failed to scan folder ${path}:`, error.message)
      return undefined
    }
  })

  await Promise.all(readPromises)
  log.info("scanFolder :: Scanning folder :: End")
}
