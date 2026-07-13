import { describe, it, expect, beforeEach } from "vitest"
import { createTestDb } from "../db/testDb.js"
import {
  getPlaylists,
  createPlaylist,
  getPlaylistTracks,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  deletePlaylist,
  updatePlaylist,
} from "./playlists.js"

let db

beforeEach(() => {
  db = createTestDb()
})

describe("createPlaylist / getPlaylists", () => {
  it("creates a playlist and returns it with a zero track count", () => {
    const created = createPlaylist(db, "Road Trip")
    expect(created.name).toBe("Road Trip")
    expect(created.track_count).toBe(0)
    expect(created.id).toBeTypeOf("number")
  })

  it("lists playlists with an accurate track_count", () => {
    const playlist = createPlaylist(db, "Road Trip")
    const trackId = db
      .prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)")
      .run("/a.mp3", "A").lastInsertRowid
    addTrackToPlaylist(db, playlist.id, trackId)

    const result = getPlaylists(db)

    expect(result).toHaveLength(1)
    expect(result[0].track_count).toBe(1)
  })
})

describe("getPlaylistTracks", () => {
  it("returns tracks belonging to the playlist, most recently added first", () => {
    const playlist = createPlaylist(db, "Road Trip")
    const trackA = db.prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)").run("/a.mp3", "A").lastInsertRowid
    const trackB = db.prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)").run("/b.mp3", "B").lastInsertRowid
    // Explicit, distinct added_at values — datetime('now') only has second
    // precision, so two inserts in the same test tick would tie and make
    // the DESC ordering assertion non-deterministic.
    db.prepare(
      "INSERT INTO playlist_tracks (playlist_id, track_id, added_at) VALUES (?, ?, ?)"
    ).run(playlist.id, trackA, "2024-01-01 00:00:00")
    db.prepare(
      "INSERT INTO playlist_tracks (playlist_id, track_id, added_at) VALUES (?, ?, ?)"
    ).run(playlist.id, trackB, "2024-01-02 00:00:00")

    const result = getPlaylistTracks(db, playlist.id)

    expect(result.map((t) => t.title)).toEqual(["B", "A"])
  })
})

describe("addTrackToPlaylist", () => {
  it("copies the track's cover onto the playlist when the playlist has none", () => {
    const playlist = createPlaylist(db, "Road Trip")
    const trackId = db
      .prepare("INSERT INTO tracks (file_path, title, cover) VALUES (?, ?, ?)")
      .run("/a.mp3", "A", "/covers/a.jpg").lastInsertRowid

    addTrackToPlaylist(db, playlist.id, trackId)

    expect(db.prepare("SELECT cover FROM playlists WHERE id = ?").get(playlist.id).cover).toBe(
      "/covers/a.jpg"
    )
  })

  it("is idempotent — adding the same track twice does not duplicate the row", () => {
    const playlist = createPlaylist(db, "Road Trip")
    const trackId = db
      .prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)")
      .run("/a.mp3", "A").lastInsertRowid

    addTrackToPlaylist(db, playlist.id, trackId)
    addTrackToPlaylist(db, playlist.id, trackId)

    expect(getPlaylistTracks(db, playlist.id)).toHaveLength(1)
  })
})

describe("removeTrackFromPlaylist", () => {
  it("removes the track from the playlist", () => {
    const playlist = createPlaylist(db, "Road Trip")
    const trackId = db
      .prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)")
      .run("/a.mp3", "A").lastInsertRowid
    addTrackToPlaylist(db, playlist.id, trackId)

    removeTrackFromPlaylist(db, playlist.id, trackId)

    expect(getPlaylistTracks(db, playlist.id)).toHaveLength(0)
  })
})

describe("deletePlaylist", () => {
  it("deletes the playlist", () => {
    const playlist = createPlaylist(db, "Road Trip")

    deletePlaylist(db, playlist.id)

    expect(getPlaylists(db)).toHaveLength(0)
  })
})

describe("updatePlaylist", () => {
  it("renames the playlist", () => {
    const playlist = createPlaylist(db, "Road Trip")

    updatePlaylist(db, playlist.id, "Summer Road Trip")

    expect(getPlaylists(db)[0].name).toBe("Summer Road Trip")
  })
})
