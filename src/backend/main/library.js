import { dialog, ipcMain } from "electron"
import { scanFolder } from "./scanner.js"
import { watchFolders } from "./watcher.js"
import {
  GET_FOLDERS_WITH_TRACK_COUNT,
  DELETE_FOLDER,
  CLEAN_ORPHAN_TRACKS,
  GET_FOLDER_PATHS,
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

  for (const folder of result.filePaths) await scanFolder(db, folder)
  watchFolders(db)

  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export function getFolders(db) {
  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export function removeFolder(db, folderPath) {
  db.prepare(DELETE_FOLDER).run(folderPath)
  db.prepare(CLEAN_ORPHAN_TRACKS).run()
  // clean up empty artists
  db.prepare(DELETE_ARTIST_WITHOUT_TRACKS).run()

  watchFolders(db)
  return db.prepare(GET_FOLDERS_WITH_TRACK_COUNT).all()
}

export async function rescanLibrary(db) {
  const folders = db.prepare(GET_FOLDER_PATHS).all()
  for (const { path } of folders) await scanFolder(db, path)
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
  ipcMain.handle("library:rescan-library", () => rescanLibrary(db))

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
