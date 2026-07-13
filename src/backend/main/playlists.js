import { ipcMain } from "electron"

export function getPlaylists(db) {
  try {
    return db
      .prepare(
        `
      SELECT
        p.*,
        COUNT(pt.track_id) as track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `
      )
      .all()
  } catch (error) {
    console.error("Error getting playlists:", error)
    throw error
  }
}

export function createPlaylist(db, name) {
  try {
    const result = db
      .prepare(
        `
      INSERT INTO playlists (name, created_at)
      VALUES (?, datetime('now'))
    `
      )
      .run(name)

    return {
      id: result.lastInsertRowid,
      name,
      cover: null,
      created_at: new Date().toISOString(),
      track_count: 0,
    }
  } catch (error) {
    console.error("Error creating playlist:", error)
    throw error
  }
}

export function getPlaylistTracks(db, playlistId) {
  try {
    return db
      .prepare(
        `
      SELECT t.*, pt.added_at
      FROM tracks t
      INNER JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.added_at DESC
    `
      )
      .all(playlistId)
  } catch (error) {
    console.error("Error getting playlist tracks:", error)
    throw error
  }
}

export function addTrackToPlaylist(db, playlistId, trackId) {
  try {
    db.prepare(
      `
      INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, added_at)
      VALUES (?, ?, datetime('now'))
    `
    ).run(playlistId, trackId)

    const playlist = db
      .prepare("SELECT cover FROM playlists WHERE id = ?")
      .get(playlistId)
    if (!playlist.cover) {
      const track = db.prepare("SELECT cover FROM tracks WHERE id = ?").get(trackId)
      if (track.cover) {
        db.prepare("UPDATE playlists SET cover = ? WHERE id = ?").run(
          track.cover,
          playlistId
        )
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error adding track to playlist:", error)
    throw error
  }
}

export function removeTrackFromPlaylist(db, playlistId, trackId) {
  try {
    db.prepare(
      `
      DELETE FROM playlist_tracks
      WHERE playlist_id = ? AND track_id = ?
    `
    ).run(playlistId, trackId)
    return { success: true }
  } catch (error) {
    console.error("Error removing track from playlist:", error)
    throw error
  }
}

export function deletePlaylist(db, playlistId) {
  try {
    db.prepare("DELETE FROM playlists WHERE id = ?").run(playlistId)
    return { success: true }
  } catch (error) {
    console.error("Error deleting playlist:", error)
    throw error
  }
}

export function updatePlaylist(db, playlistId, name) {
  try {
    db.prepare("UPDATE playlists SET name = ? WHERE id = ?").run(name, playlistId)
    return { success: true }
  } catch (error) {
    console.error("Error updating playlist:", error)
    throw error
  }
}

export function registerPlaylistHandlers(mainWindow, db) {
  ipcMain.handle("get-playlists", async () => getPlaylists(db))
  ipcMain.handle("create-playlist", async (event, name) => createPlaylist(db, name))
  ipcMain.handle("get-playlist-tracks", async (event, playlistId) => getPlaylistTracks(db, playlistId))
  ipcMain.handle("add-track-to-playlist", async (event, playlistId, trackId) =>
    addTrackToPlaylist(db, playlistId, trackId)
  )
  ipcMain.handle("remove-track-from-playlist", async (event, playlistId, trackId) =>
    removeTrackFromPlaylist(db, playlistId, trackId)
  )
  ipcMain.handle("delete-playlist", async (event, playlistId) => deletePlaylist(db, playlistId))
  ipcMain.handle("update-playlist", async (event, playlistId, name) => updatePlaylist(db, playlistId, name))
}
