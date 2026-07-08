import fs from "node:fs"
import path from "node:path"
import { app } from "electron"
import { parseAudioFile } from "../utils/audioMeta.js"
import {
  INSERT_FOLDER_IF_NOT_EXISTS,
  GET_FOLDER_ID_BY_PATH,
  GET_TRACK_PATHS_BY_FOLDER,
  DELETE_TRACK_BY_PATH,
  INSERT_ARTIST_IF_NOT_EXISTS,
  GET_ARTIST_BY_NAME,
  UPDATE_ARTIST_COVER,
  CHECK_TRACK_EXISTS,
  UPSERT_TRACK,
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

async function readTracksFromFoldersAndSetInDB(db, folderPath) {
  log.info("readTracksFromFoldersAndSetInDB :: Start :: ", folderPath)

  // Insert or get folder
  db.prepare(INSERT_FOLDER_IF_NOT_EXISTS).run(folderPath)
  const folderId = db.prepare(GET_FOLDER_ID_BY_PATH).get(folderPath).id

  // Collect audio files
  const filesOnDisk = fs
    .readdirSync(folderPath)
    .filter((f) => /\.(mp3|flac|m4a|wav|ogg|aac)$/i.test(f))
    .map((f) => path.join(folderPath, f))

  log.info("readTracksFromFoldersAndSetInDB :: fetched all music files")

  // Remove missing tracks
  const existingTracks = db
    .prepare(GET_TRACK_PATHS_BY_FOLDER)
    .all(folderId)
    .map((t) => t.file_path)

  const missing = existingTracks.filter((f) => !filesOnDisk.includes(f))
  if (missing.length) {
    const del = db.prepare(DELETE_TRACK_BY_PATH)
    for (const file of missing) del.run(file)
  }
  log.info(
    "readTracksFromFoldersAndSetInDB :: remove deleted music files from db :: ",
    missing
  )

  // Prepare statements
  const insertArtist = db.prepare(INSERT_ARTIST_IF_NOT_EXISTS)
  const getArtist = db.prepare(GET_ARTIST_BY_NAME)
  const updateArtistCover = db.prepare(UPDATE_ARTIST_COVER)
  const checkTrackExists = db.prepare(CHECK_TRACK_EXISTS)
  const upsertTrack = db.prepare(UPSERT_TRACK)

  // Scan files
  log.info(
    "readTracksFromFoldersAndSetInDB :: get meta data for each music file :: START"
  )
  for (const filePath of filesOnDisk) {
    const exists = checkTrackExists.get(filePath)
    if (exists) continue

    try {
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

      // Insert or update track
      upsertTrack.run(
        folderId,
        artistId,
        filePath,
        title || path.basename(filePath),
        album || "",
        artistName,
        duration,
        coverData
      )
    } catch (err) {
      log.warn(
        "readTracksFromFoldersAndSetInDB :: Metadata read failed for:",
        filePath,
        "::",
        err.message
      )
    }
  }
  log.info(
    "readTracksFromFoldersAndSetInDB :: get meta data for each music file :: End"
  )
  log.info(`readTracksFromFoldersAndSetInDB :: Folder scanned: ${folderPath}`)
}

export async function scanFolder(db, folderPath) {
  log.info("scanFolder :: Scanning folder :: Start :: ", folderPath) // get all folders inside folderPath (current recursion limit is 3 levels)

  const folderPaths = getFoldersRecursive(folderPath, 1)
  // add the root folder as well as it might have songs files
  folderPaths.push(folderPath)
  log.info("scanFolder :: folderPaths :: ", folderPaths)

  const readPromises = folderPaths.map(async (path) => {
    try {
      return await readTracksFromFoldersAndSetInDB(db, path)
    } catch (error) {
      log.error(`scanFolder :: Failed to scan folder ${path}:`, error.message)
      return undefined
    }
  })

  await Promise.all(readPromises)
  log.info("scanFolder :: Scanning folder :: End")
}
