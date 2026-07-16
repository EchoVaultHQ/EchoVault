import path from "node:path"
import { dialog, ipcMain } from "electron"
import { scanFolder, countAudioFiles } from "./scanner.js"
import { watchFolders } from "./watcher.js"
import { promoteLocationOrDeleteTrack, mergeMetadataDuplicates } from "./trackDedupe.js"
import {
  GET_FOLDERS_WITH_TRACK_COUNT,
  DELETE_FOLDER,
  CLEAN_ORPHAN_TRACKS,
  CLEAN_ORPHAN_TRACK_LOCATIONS,
  GET_FOLDER_PATHS,
  GET_FOLDER_ID_BY_PATH,
  GET_TRACK_PATHS_BY_FOLDER,
  DELETE_ARTIST_WITHOUT_TRACKS,
  INCREMENT_PLAY_COUNT,
  GET_TOP_PLAYED_TRACKS,
  GET_TOP_PLAYED_ARTISTS,
  GET_TOTAL_PLAYS,
  GET_RECENTLY_PLAYED,
  GET_LAST_SCANNED_AT,
  GET_ARTIST_BY_NAME,
} from "../db/queries.js"

export async function addFolder(mainWindow, db) {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "multiSelections"],
  })
  if (result.canceled) return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()

  const send = (channel, payload) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  }
  const total = result.filePaths.reduce((sum, folder) => sum + countAudioFiles(folder), 0)
  let current = 0

  for (const folder of result.filePaths) {
    await scanFolder(db, folder, ({ filePath }) => {
      current++
      send("library:scan-progress", {
        phase: "add",
        current,
        total,
        pct: total ? Math.min(100, Math.round((current / total) * 100)) : 0,
        message: path.basename(filePath),
        folderPath: folder,
      })
    })
  }
  mergeMetadataDuplicates(db)
  watchFolders(db)

  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export function getFolders(db) {
  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export function removeFolder(db, folderPath) {
  // Promote any track whose primary copy lives in this folder to a
  // surviving location elsewhere *before* deleting the folder - DELETE_FOLDER
  // cascades to tracks/track_locations immediately, so this must run first.
  const folder = db.prepare(GET_FOLDER_ID_BY_PATH).get(folderPath)
  if (folder) {
    const paths = db.prepare(GET_TRACK_PATHS_BY_FOLDER).all(folder.id).map((t) => t.file_path)
    for (const p of paths) promoteLocationOrDeleteTrack(db, p)
  }

  db.prepare(DELETE_FOLDER).run(folderPath)
  db.prepare(CLEAN_ORPHAN_TRACKS).run()
  db.prepare(CLEAN_ORPHAN_TRACK_LOCATIONS).run()
  // clean up empty artists
  db.prepare(DELETE_ARTIST_WITHOUT_TRACKS).run()

  watchFolders(db)
  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export async function rescanLibrary(mainWindow, db) {
  const folders = db.prepare(GET_FOLDER_PATHS).all()

  const send = (channel, payload) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
  }
  const total = folders.reduce((sum, { path: folderPath }) => sum + countAudioFiles(folderPath), 0)
  let current = 0

  for (const { path: folderPath } of folders) {
    await scanFolder(db, folderPath, ({ filePath }) => {
      current++
      send("library:scan-progress", {
        phase: "rescan",
        current,
        total,
        pct: total ? Math.min(100, Math.round((current / total) * 100)) : 0,
        message: path.basename(filePath),
        folderPath,
      })
    })
  }
  mergeMetadataDuplicates(db)
  watchFolders(db)
  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export function getLastScanned(db) {
  return db.prepare(GET_LAST_SCANNED_AT).get()?.lastScannedAt || null
}

export function incrementPlayCount(db, trackId) {
  try {
    const stmt = db.prepare(INCREMENT_PLAY_COUNT)
    stmt.run(trackId)
    return { success: true }
  } catch (error) {
    console.error("Error incrementing play count:", error)
    throw error
  }
}

export async function getTopPlayedTracks(db) {
  try {
    const stmt = db.prepare(GET_TOP_PLAYED_TRACKS)
    const tracks = stmt.all()

    // Add cover data URLs using custom protocol
    const withCovers = await Promise.all(
      tracks.map(async (track) => {
        if (track.cover) {
          const url = track.cover.startsWith("/")
            ? `echovault://${track.cover}`
            : `echovault:///${track.cover}`
          return {
            ...track,
            coverDataUrl: url,
          }
        } else {
          return { ...track, coverDataUrl: null }
        }
      })
    )

    return withCovers
  } catch (error) {
    console.error("Error getting top played tracks:", error)
    return []
  }
}

export async function getRecentlyPlayed(db) {
  try {
    const stmt = db.prepare(GET_RECENTLY_PLAYED)
    const tracks = stmt.all()

    const withCovers = await Promise.all(
      tracks.map(async (track) => {
        if (track.cover) {
          const url = track.cover.startsWith("/")
            ? `echovault://${track.cover}`
            : `echovault:///${track.cover}`
          return { ...track, coverDataUrl: url }
        }
        return { ...track, coverDataUrl: null }
      })
    )

    return withCovers
  } catch (error) {
    console.error("Error getting recently played tracks:", error)
    return []
  }
}

export function getTopPlayedArtists(db) {
  try {
    const stmt = db.prepare(GET_TOP_PLAYED_ARTISTS)
    return stmt.all()
  } catch (error) {
    console.error("Error getting top played artists:", error)
    return []
  }
}

export function getTotalPlays(db) {
  try {
    const stmt = db.prepare(GET_TOTAL_PLAYS)
    const result = stmt.get()
    return { totalPlays: result.totalPlays || 0 }
  } catch (error) {
    console.error("Error getting total plays:", error)
    return { totalPlays: 0 }
  }
}

export function getArtistByName(db, name) {
  try {
    const stmt = db.prepare(GET_ARTIST_BY_NAME)
    const artist = stmt.get(name)
    return artist || null
  } catch (error) {
    console.error("Error getting artist by name:", error)
    return null
  }
}

export function registerLibraryHandlers(mainWindow, db) {
  // add folder
  ipcMain.handle("library:add-folder", () => addFolder(mainWindow, db))

  // folders
  ipcMain.handle("library:get-folders", () => getFolders(db))

  // remove folder
  ipcMain.handle("library:remove-folder", (e, folderPath) => removeFolder(db, folderPath))

  // rescan
  ipcMain.handle("library:rescan-library", () => rescanLibrary(mainWindow, db))

  // last scanned (global, across all folders)
  ipcMain.handle("library:get-last-scanned", () => getLastScanned(db))

  // Increment play count when a track is played
  ipcMain.handle("increment-play-count", (event, trackId) => incrementPlayCount(db, trackId))

  // Get top 10 most played tracks
  ipcMain.handle("get-top-played-tracks", () => getTopPlayedTracks(db))

  // Get most recently played tracks (for Library "Recently Played" panel)
  ipcMain.handle("get-recently-played", () => getRecentlyPlayed(db))

  // Get top 10 most played artists
  ipcMain.handle("get-top-played-artists", () => getTopPlayedArtists(db))

  // Get total plays count
  ipcMain.handle("get-total-plays", () => getTotalPlays(db))

  // Get artist by name (for cover data)
  ipcMain.handle("get-artist-by-name", (event, name) => getArtistByName(db, name))
}
