import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import fs from "fs"
import os from "os"
import path from "path"
import { createTestDb } from "../db/testDb.js"
import { parseAudioFile } from "../utils/audioMeta.js"
import { extractEmbeddedLyrics } from "../utils/embeddedLyrics.js"
import { fetchLyricsFromLrclib } from "../utils/lrclibClient.js"
import {
  getTracks,
  getRecentTracks,
  getLikedTracks,
  getEnhancedTracks,
  updateLike,
  getLyrics,
} from "./tracks.js"

vi.mock("../utils/audioMeta.js", () => ({ parseAudioFile: vi.fn() }))
vi.mock("../utils/embeddedLyrics.js", () => ({ extractEmbeddedLyrics: vi.fn() }))
vi.mock("../utils/lrclibClient.js", () => ({ fetchLyricsFromLrclib: vi.fn() }))

let db

beforeEach(() => {
  db = createTestDb()
  vi.clearAllMocks()
})

function insertTrack(overrides = {}) {
  const t = {
    file_path: `/music/${Math.random()}.mp3`,
    title: "Untitled",
    album: "",
    artist: "",
    isLiked: 0,
    isEnhanced: 0,
    ...overrides,
  }
  db.prepare(
    "INSERT INTO tracks (file_path, title, album, artist, isLiked, isEnhanced) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(t.file_path, t.title, t.album, t.artist, t.isLiked, t.isEnhanced)
}

describe("getTracks", () => {
  it("returns all tracks ordered by title", () => {
    insertTrack({ file_path: "/a", title: "Zebra" })
    insertTrack({ file_path: "/b", title: "Apple" })
    expect(getTracks(db).map((t) => t.title)).toEqual(["Apple", "Zebra"])
  })
})

describe("getRecentTracks", () => {
  it("returns at most 15 tracks, most recently inserted first", () => {
    for (let i = 0; i < 20; i++) insertTrack({ file_path: `/track${i}`, title: `Track ${i}` })
    const result = getRecentTracks(db)
    expect(result).toHaveLength(15)
    expect(result[0].title).toBe("Track 19")
  })
})

describe("getLikedTracks / getEnhancedTracks", () => {
  it("only returns tracks with the matching flag set", () => {
    insertTrack({ file_path: "/liked", title: "Liked", isLiked: 1 })
    insertTrack({ file_path: "/enhanced", title: "Enhanced", isEnhanced: 1 })
    insertTrack({ file_path: "/plain", title: "Plain" })

    expect(getLikedTracks(db).map((t) => t.title)).toEqual(["Liked"])
    expect(getEnhancedTracks(db).map((t) => t.title)).toEqual(["Enhanced"])
  })
})

describe("updateLike", () => {
  it("sets isLiked and returns true when a row was changed", () => {
    insertTrack({ file_path: "/x", title: "X" })
    const trackId = db.prepare("SELECT id FROM tracks WHERE file_path = ?").get("/x").id

    const changed = updateLike(db, trackId, true)

    expect(changed).toBe(true)
    expect(db.prepare("SELECT isLiked FROM tracks WHERE id = ?").get(trackId).isLiked).toBe(1)
  })

  it("returns false when no matching track exists", () => {
    expect(updateLike(db, 9999, true)).toBe(false)
  })
})

describe("getLyrics", () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-tracks-test-"))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns .lrc file contents when a sidecar .lrc file exists, without touching audio metadata", async () => {
    const audioPath = path.join(tmpDir, "song.mp3")
    fs.writeFileSync(
      path.join(tmpDir, "song.lrc"),
      "[00:01.00]First line\n[00:05.00]Second line"
    )

    const result = await getLyrics(audioPath)

    expect(parseAudioFile).not.toHaveBeenCalled()
    expect(result.source).toBe("lrc")
    expect(result.synchronized).toBe(true)
    expect(result.text).toBe("First line\nSecond line")
    expect(result.timestamps[0]).toEqual({ startTime: 1, endTime: 5, text: "First line" })
  })

  it("falls through to embedded tags when there is no sidecar .lrc file", async () => {
    parseAudioFile.mockResolvedValue({ common: {}, format: {} })
    extractEmbeddedLyrics.mockReturnValue({
      text: "la la la",
      synchronized: true,
      timestamps: [
        { time: 0, text: "la la la" },
        { time: 3, text: "next line" },
      ],
    })

    const result = await getLyrics(path.join(tmpDir, "embedded.mp3"))

    expect(result.source).toBe("embedded")
    expect(result.synchronized).toBe(true)
    expect(result.timestamps).toEqual([
      { startTime: 0, endTime: 3, text: "la la la" },
      { startTime: 3, endTime: Infinity, text: "next line" },
    ])
    expect(fetchLyricsFromLrclib).not.toHaveBeenCalled()
  })

  it("returns null timestamps for non-synchronized embedded lyrics", async () => {
    parseAudioFile.mockResolvedValue({ common: {}, format: {} })
    extractEmbeddedLyrics.mockReturnValue({ text: "plain lyrics", synchronized: false })

    const result = await getLyrics(path.join(tmpDir, "plain-embedded.mp3"))

    expect(result).toEqual({
      text: "plain lyrics",
      timestamps: null,
      synchronized: false,
      source: "embedded",
    })
  })

  it("falls through to an online lookup, and writes a real .lrc sidecar on a hit", async () => {
    parseAudioFile.mockResolvedValue({
      common: { artist: "Artist", title: "Title", album: "Album" },
      format: { duration: 200 },
    })
    extractEmbeddedLyrics.mockReturnValue(null)
    fetchLyricsFromLrclib.mockResolvedValue({
      lyrics: {
        text: "online line",
        synchronized: true,
        timestamps: [{ startTime: 1.5, endTime: Infinity, text: "online line" }],
      },
      reason: "ok",
    })

    const audioPath = path.join(tmpDir, "online-hit.mp3")
    const result = await getLyrics(audioPath)

    expect(fetchLyricsFromLrclib).toHaveBeenCalledWith({
      artist: "Artist",
      title: "Title",
      album: "Album",
      duration: 200,
    })
    expect(result.source).toBe("online")
    expect(fs.readFileSync(path.join(tmpDir, "online-hit.lrc"), "utf-8")).toBe(
      "[00:01.50]online line"
    )
  })

  it("caches an online miss per file path, skipping a second lookup for the same file", async () => {
    parseAudioFile.mockResolvedValue({ common: { artist: "A", title: "T" }, format: {} })
    extractEmbeddedLyrics.mockReturnValue(null)
    fetchLyricsFromLrclib.mockResolvedValue({ lyrics: null, reason: "no-synced-lyrics" })

    const audioPath = path.join(tmpDir, "miss-cached.mp3")
    const first = await getLyrics(audioPath)
    expect(first).toMatchObject({ text: null, source: null, reason: "no-synced-lyrics" })
    expect(fetchLyricsFromLrclib).toHaveBeenCalledOnce()

    const second = await getLyrics(audioPath)
    expect(second).toEqual({ text: null, timestamps: null, synchronized: false, source: null })
    expect(fetchLyricsFromLrclib).toHaveBeenCalledOnce() // not called again
  })

  it("skips the online lookup entirely when fetchOnline is false", async () => {
    parseAudioFile.mockResolvedValue({ common: {}, format: {} })
    extractEmbeddedLyrics.mockReturnValue(null)

    const result = await getLyrics(path.join(tmpDir, "offline.mp3"), { fetchOnline: false })

    expect(fetchLyricsFromLrclib).not.toHaveBeenCalled()
    expect(result).toEqual({ text: null, timestamps: null, synchronized: false, source: null })
  })

  it("still returns the online result even if writing the .lrc sidecar fails", async () => {
    parseAudioFile.mockResolvedValue({ common: { artist: "A", title: "T" }, format: {} })
    extractEmbeddedLyrics.mockReturnValue(null)
    fetchLyricsFromLrclib.mockResolvedValue({
      lyrics: { text: "x", synchronized: true, timestamps: [{ startTime: 0, endTime: Infinity, text: "x" }] },
      reason: "ok",
    })

    // A path inside a directory that doesn't exist makes the real writeFileSync fail (ENOENT).
    const audioPath = path.join(tmpDir, "no-such-subdir", "write-fails.mp3")
    const result = await getLyrics(audioPath)
    expect(result.source).toBe("online")
  })

  it("returns the empty shape when reading audio metadata throws", async () => {
    parseAudioFile.mockRejectedValue(new Error("corrupt file"))

    const result = await getLyrics(path.join(tmpDir, "corrupt.mp3"))

    expect(result).toEqual({ text: null, timestamps: null, synchronized: false, source: null })
  })
})
