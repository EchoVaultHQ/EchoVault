import { describe, it, expect, beforeEach } from "vitest"
import { createTestDb } from "../db/testDb.js"
import { promoteLocationOrDeleteTrack, mergeTrackIntoCanonical, mergeMetadataDuplicates } from "./trackDedupe.js"

let db

beforeEach(() => {
  db = createTestDb()
})

function insertTrack(overrides = {}) {
  const cols = {
    folder_id: null,
    artist_id: null,
    file_path: "/a.mp3",
    title: "A",
    noOfPlays: 0,
    isLiked: 0,
    isEnhanced: 0,
    last_played_at: null,
    file_size: 100,
    content_hash: "hash-a",
    ...overrides,
  }
  const keys = Object.keys(cols)
  const id = db
    .prepare(`INSERT INTO tracks (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`)
    .run(...keys.map((k) => cols[k])).lastInsertRowid
  return db.prepare("SELECT * FROM tracks WHERE id = ?").get(id)
}

describe("promoteLocationOrDeleteTrack", () => {
  it("removing a secondary location's path just deletes that location row", () => {
    const track = insertTrack({ file_path: "/primary.flac" })
    db.prepare("INSERT INTO track_locations (track_id, file_path, file_size) VALUES (?, ?, ?)").run(
      track.id,
      "/secondary.flac",
      200
    )

    promoteLocationOrDeleteTrack(db, "/secondary.flac")

    expect(db.prepare("SELECT * FROM track_locations").all()).toEqual([])
    const stillThere = db.prepare("SELECT * FROM tracks WHERE id = ?").get(track.id)
    expect(stillThere.file_path).toBe("/primary.flac")
  })

  it("promotes a surviving location to primary when the primary path disappears", () => {
    const track = insertTrack({ file_path: "/primary.flac", noOfPlays: 7, isLiked: 1 })
    db.prepare(
      "INSERT INTO track_locations (track_id, folder_id, file_path, file_size) VALUES (?, ?, ?, ?)"
    ).run(track.id, null, "/secondary.flac", 200)

    promoteLocationOrDeleteTrack(db, "/primary.flac")

    const updated = db.prepare("SELECT * FROM tracks WHERE id = ?").get(track.id)
    expect(updated.file_path).toBe("/secondary.flac")
    expect(updated.file_size).toBe(200)
    expect(updated.noOfPlays).toBe(7)
    expect(updated.isLiked).toBe(1)
    expect(db.prepare("SELECT * FROM track_locations").all()).toEqual([])
  })

  it("deletes the track when its only path disappears and no location survives", () => {
    insertTrack({ file_path: "/only.mp3" })

    promoteLocationOrDeleteTrack(db, "/only.mp3")

    expect(db.prepare("SELECT * FROM tracks").all()).toEqual([])
  })

  it("does nothing for a path that matches neither a track nor a location", () => {
    insertTrack({ file_path: "/unrelated.mp3" })

    expect(() => promoteLocationOrDeleteTrack(db, "/nonexistent.mp3")).not.toThrow()
    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
  })
})

describe("mergeTrackIntoCanonical", () => {
  it("sums play stats, ORs liked/enhanced, keeps the latest last_played_at, repoints playlists, and files the duplicate as a location", () => {
    const canonical = insertTrack({
      file_path: "/canonical.flac",
      noOfPlays: 3,
      isLiked: 1,
      isEnhanced: 0,
      last_played_at: "2024-01-01 00:00:00",
      content_hash: "shared-hash",
    })
    const duplicate = insertTrack({
      file_path: "/duplicate.flac",
      folder_id: null,
      noOfPlays: 5,
      isLiked: 0,
      isEnhanced: 1,
      last_played_at: "2024-02-01 00:00:00",
      file_size: 300,
      content_hash: "shared-hash",
    })

    const playlistId = db.prepare("INSERT INTO playlists (name) VALUES (?)").run("Mix").lastInsertRowid
    // Both the canonical and the duplicate were already added to the same playlist -
    // repointing must not violate the (playlist_id, track_id) primary key.
    db.prepare("INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)").run(playlistId, canonical.id)
    db.prepare("INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)").run(playlistId, duplicate.id)

    mergeTrackIntoCanonical(db, canonical, duplicate)

    const tracks = db.prepare("SELECT * FROM tracks").all()
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe(canonical.id)
    expect(tracks[0].noOfPlays).toBe(8)
    expect(tracks[0].isLiked).toBe(1)
    expect(tracks[0].isEnhanced).toBe(1)
    expect(tracks[0].last_played_at).toBe("2024-02-01 00:00:00")

    const locations = db.prepare("SELECT * FROM track_locations").all()
    expect(locations).toEqual([
      expect.objectContaining({ track_id: canonical.id, file_path: "/duplicate.flac", file_size: 300 }),
    ])

    const playlistRows = db.prepare("SELECT * FROM playlist_tracks WHERE playlist_id = ?").all(playlistId)
    expect(playlistRows).toEqual([expect.objectContaining({ track_id: canonical.id })])
  })
})

describe("mergeMetadataDuplicates", () => {
  it("merges tracks sharing title+album+artist but with different content_hash into the earliest row", () => {
    const first = insertTrack({
      file_path: "/rip1.mp3",
      title: "7 rings",
      album: "thank u, next",
      content_hash: "hash-1",
      noOfPlays: 2,
    })
    const second = insertTrack({
      file_path: "/rip2.mp3",
      title: "7 rings",
      album: "thank u, next",
      content_hash: "hash-2",
      noOfPlays: 5,
    })

    mergeMetadataDuplicates(db)

    const tracks = db.prepare("SELECT * FROM tracks").all()
    expect(tracks).toEqual([expect.objectContaining({ id: first.id, noOfPlays: 7 })])

    const locations = db.prepare("SELECT * FROM track_locations").all()
    expect(locations).toEqual([expect.objectContaining({ track_id: first.id, file_path: second.file_path })])
  })

  it("leaves tracks with different metadata untouched", () => {
    insertTrack({ file_path: "/a.mp3", title: "Song A", album: "Album A" })
    insertTrack({ file_path: "/b.mp3", title: "Song B", album: "Album B" })

    mergeMetadataDuplicates(db)

    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(2)
  })

  it("matches title/album case- and whitespace-insensitively", () => {
    const first = insertTrack({ file_path: "/a.mp3", title: "Song", album: "Album" })
    insertTrack({ file_path: "/b.mp3", title: "  SONG  ", album: "album", content_hash: "hash-b" })

    mergeMetadataDuplicates(db)

    expect(db.prepare("SELECT * FROM tracks").all()).toEqual([expect.objectContaining({ id: first.id })])
  })
})
