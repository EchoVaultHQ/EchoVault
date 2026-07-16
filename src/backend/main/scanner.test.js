import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import os from "os"
import path from "path"
import { app } from "electron"
import { extractMetadata, scanFolder, countAudioFiles } from "./scanner.js"
import { createTestDb } from "../db/testDb.js"
import { parseAudioFile } from "../utils/audioMeta.js"

vi.mock("../utils/audioMeta.js", () => ({
  parseAudioFile: vi.fn(),
}))

let tmpDir

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-test-"))
  app.getPath.mockReturnValue(tmpDir)
  vi.clearAllMocks()
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("extractMetadata", () => {
  it("returns title/artist/album/duration from the parsed tags", async () => {
    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 180 },
    })

    const result = await extractMetadata("/music/song.mp3")

    expect(result).toEqual({
      title: "Song",
      artist: "Artist",
      album: "Album",
      duration: 180,
      cover: null,
    })
  })

  it("falls back to the filename and 'Unknown' when tags are missing", async () => {
    parseAudioFile.mockResolvedValue({ common: {}, format: {} })

    const result = await extractMetadata("/music/untitled.mp3")

    expect(result).toEqual({
      title: "untitled.mp3",
      artist: "Unknown",
      album: "Unknown",
      duration: 0,
      cover: null,
    })
  })

  it("writes an embedded cover image to the covers dir and returns its path", async () => {
    parseAudioFile.mockResolvedValue({
      common: { title: "Song", picture: [{ data: Buffer.from("fake-jpeg-bytes") }] },
      format: { duration: 180 },
    })

    const result = await extractMetadata("/music/song.mp3")

    expect(result.cover).toBe(path.join(tmpDir, "covers", "song.mp3.jpg"))
    expect(fs.readFileSync(result.cover).toString()).toBe("fake-jpeg-bytes")
  })

  it("returns null when parsing the file throws", async () => {
    parseAudioFile.mockRejectedValue(new Error("corrupt file"))

    expect(await extractMetadata("/music/broken.mp3")).toBeNull()
  })
})

describe("scanFolder", () => {
  it("inserts a track for each audio file found in the folder", async () => {
    const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-music-"))
    fs.writeFileSync(path.join(musicDir, "a.mp3"), "")
    fs.writeFileSync(path.join(musicDir, "notes.txt"), "")

    parseAudioFile.mockResolvedValue({
      common: { title: "A", artist: "Artist A", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()

    try {
      await scanFolder(db, musicDir)

      const tracks = db.prepare("SELECT title, artist FROM tracks").all()
      expect(tracks).toEqual([{ title: "A", artist: "Artist A" }])
    } finally {
      fs.rmSync(musicDir, { recursive: true, force: true })
    }
  })

  it("does not re-parse a file that's already in the db", async () => {
    const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-music-"))
    fs.writeFileSync(path.join(musicDir, "a.mp3"), "")

    parseAudioFile.mockResolvedValue({
      common: { title: "A", artist: "Artist A", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()

    try {
      await scanFolder(db, musicDir)
      parseAudioFile.mockClear()
      await scanFolder(db, musicDir)

      expect(parseAudioFile).not.toHaveBeenCalled()
    } finally {
      fs.rmSync(musicDir, { recursive: true, force: true })
    }
  })

  it("same content in two different folders becomes one track plus a location, not two tracks", async () => {
    const musicDirA = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-music-a-"))
    const musicDirB = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-music-b-"))
    fs.writeFileSync(path.join(musicDirA, "song.mp3"), "identical-bytes")
    fs.writeFileSync(path.join(musicDirB, "song.mp3"), "identical-bytes")

    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()

    try {
      await scanFolder(db, musicDirA)
      await scanFolder(db, musicDirB)

      const tracks = db.prepare("SELECT * FROM tracks").all()
      expect(tracks).toHaveLength(1)
      expect(tracks[0].content_hash).toBeTruthy()

      const locations = db.prepare("SELECT * FROM track_locations").all()
      expect(locations).toEqual([
        expect.objectContaining({
          track_id: tracks[0].id,
          file_path: path.join(musicDirB, "song.mp3"),
        }),
      ])
    } finally {
      fs.rmSync(musicDirA, { recursive: true, force: true })
      fs.rmSync(musicDirB, { recursive: true, force: true })
    }
  })

  it("does not create two tracks when identical-content files sit in two subfolders scanned concurrently", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-nested-"))
    const sub1 = fs.mkdtempSync(path.join(rootDir, "sub1-"))
    const sub2 = fs.mkdtempSync(path.join(rootDir, "sub2-"))
    fs.writeFileSync(path.join(sub1, "song.mp3"), "identical-bytes")
    fs.writeFileSync(path.join(sub2, "song.mp3"), "identical-bytes")

    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()

    try {
      // scanFolder walks sub1/sub2 concurrently (Promise.all internally) -
      // this used to be able to race and insert two tracks for one song.
      await scanFolder(db, rootDir)

      expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
      expect(db.prepare("SELECT * FROM track_locations").all()).toHaveLength(1)
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("merges a pre-existing legacy duplicate (two rows, identical bytes) into one track with summed stats", async () => {
    const musicDirA = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-legacy-a-"))
    const musicDirB = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-legacy-b-"))
    const pathA = path.join(musicDirA, "song.mp3")
    const pathB = path.join(musicDirB, "song.mp3")
    fs.writeFileSync(pathA, "identical-bytes")
    fs.writeFileSync(pathB, "identical-bytes")

    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()
    // Simulate two rows created before content hashing existed: no content_hash,
    // no file_size, differing noOfPlays.
    db.prepare("INSERT INTO tracks (file_path, title, noOfPlays) VALUES (?, ?, ?)").run(pathA, "Song", 2)
    db.prepare("INSERT INTO tracks (file_path, title, noOfPlays) VALUES (?, ?, ?)").run(pathB, "Song", 5)

    try {
      await scanFolder(db, musicDirA)
      await scanFolder(db, musicDirB)

      const tracks = db.prepare("SELECT * FROM tracks").all()
      expect(tracks).toHaveLength(1)
      expect(tracks[0].noOfPlays).toBe(7)

      const locations = db.prepare("SELECT * FROM track_locations").all()
      expect(locations).toHaveLength(1)
      expect(locations[0].track_id).toBe(tracks[0].id)
    } finally {
      fs.rmSync(musicDirA, { recursive: true, force: true })
      fs.rmSync(musicDirB, { recursive: true, force: true })
    }
  })

  it("promotes a surviving location to primary instead of deleting the track when the primary file is removed", async () => {
    const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-promote-"))
    fs.writeFileSync(path.join(musicDir, "a.mp3"), "identical-bytes")
    fs.writeFileSync(path.join(musicDir, "b.mp3"), "identical-bytes")

    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()

    try {
      await scanFolder(db, musicDir)

      const before = db.prepare("SELECT * FROM tracks").all()
      expect(before).toHaveLength(1)
      const location = db.prepare("SELECT * FROM track_locations").get()
      expect(location).toBeTruthy()

      fs.rmSync(before[0].file_path)
      await scanFolder(db, musicDir)

      const after = db.prepare("SELECT * FROM tracks").all()
      expect(after).toHaveLength(1)
      expect(after[0].file_path).toBe(location.file_path)
      expect(db.prepare("SELECT * FROM track_locations").all()).toEqual([])
    } finally {
      fs.rmSync(musicDir, { recursive: true, force: true })
    }
  })

  it("does not resurrect a path already recorded as a location of another track on rescan", async () => {
    const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-relocated-"))
    const locationPath = path.join(musicDir, "already-merged.mp3")
    fs.writeFileSync(locationPath, "different-bytes-same-song")

    parseAudioFile.mockResolvedValue({
      common: { title: "Song", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()
    const canonicalId = db
      .prepare("INSERT INTO tracks (file_path, title, content_hash) VALUES (?, ?, ?)")
      .run(path.join(musicDir, "canonical.mp3"), "Song", "hash-1").lastInsertRowid
    db.prepare("INSERT INTO track_locations (track_id, file_path, file_size) VALUES (?, ?, ?)").run(
      canonicalId,
      locationPath,
      fs.statSync(locationPath).size
    )

    try {
      await scanFolder(db, musicDir)

      expect(parseAudioFile).not.toHaveBeenCalled()
      expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
      expect(db.prepare("SELECT * FROM track_locations").all()).toHaveLength(1)
    } finally {
      fs.rmSync(musicDir, { recursive: true, force: true })
    }
  })

  it("calls onFile once per real audio file on disk", async () => {
    const musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-scanner-onfile-"))
    fs.writeFileSync(path.join(musicDir, "a.mp3"), "")
    fs.writeFileSync(path.join(musicDir, "b.mp3"), "")
    fs.writeFileSync(path.join(musicDir, "notes.txt"), "")

    parseAudioFile.mockResolvedValue({
      common: { title: "A", artist: "Artist", album: "Album" },
      format: { duration: 100 },
    })

    const db = createTestDb()
    const onFile = vi.fn()

    try {
      await scanFolder(db, musicDir, onFile)

      expect(onFile).toHaveBeenCalledTimes(2)
      expect(onFile).toHaveBeenCalledWith({ filePath: path.join(musicDir, "a.mp3") })
      expect(onFile).toHaveBeenCalledWith({ filePath: path.join(musicDir, "b.mp3") })
    } finally {
      fs.rmSync(musicDir, { recursive: true, force: true })
    }
  })
})

describe("countAudioFiles", () => {
  it("counts matching audio files across the root and nested subfolders", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-count-"))
    const sub = fs.mkdtempSync(path.join(rootDir, "sub-"))
    fs.writeFileSync(path.join(rootDir, "a.mp3"), "")
    fs.writeFileSync(path.join(rootDir, "notes.txt"), "")
    fs.writeFileSync(path.join(sub, "b.flac"), "")

    try {
      expect(countAudioFiles(rootDir)).toBe(2)
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it("returns 0 for a nonexistent path without throwing", () => {
    expect(countAudioFiles("/nonexistent/path/does-not-exist")).toBe(0)
  })
})
