import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import os from "os"
import path from "path"
import chokidar from "chokidar"
import { watchFolders } from "./watcher.js"
import { extractMetadata } from "./scanner.js"
import { createTestDb } from "../db/testDb.js"

vi.mock("chokidar", () => ({
  default: { watch: vi.fn() },
}))

vi.mock("./scanner.js", () => ({
  extractMetadata: vi.fn(),
}))

function createFakeWatcher() {
  const handlers = {}
  const watcher = {
    on: vi.fn((event, cb) => {
      handlers[event] = cb
      return watcher
    }),
    close: vi.fn(),
  }
  return { watcher, handlers }
}

let db
let tmpDir
let handlers

beforeEach(() => {
  db = createTestDb()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "echovault-watcher-test-"))
  vi.clearAllMocks()

  const fake = createFakeWatcher()
  handlers = fake.handlers
  chokidar.watch.mockReturnValue(fake.watcher)

  db.prepare("INSERT INTO folders (path) VALUES (?)").run(tmpDir)
  watchFolders(db)
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("add handler", () => {
  it("parses metadata and inserts a new track when the content hash is unseen", async () => {
    const filePath = path.join(tmpDir, "song.mp3")
    fs.writeFileSync(filePath, "brand-new-bytes")
    extractMetadata.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album", duration: 100, cover: null })

    await handlers.add(filePath)

    const tracks = db.prepare("SELECT * FROM tracks").all()
    expect(tracks).toEqual([expect.objectContaining({ file_path: filePath, title: "Song" })])
    expect(tracks[0].content_hash).toBeTruthy()
    expect(extractMetadata).toHaveBeenCalledWith(filePath)
  })

  it("does not create two tracks when two identical-content files are added concurrently (chokidar doesn't await handlers)", async () => {
    const pathA = path.join(tmpDir, "a.mp3")
    const pathB = path.join(tmpDir, "b.mp3")
    fs.writeFileSync(pathA, "shared-bytes")
    fs.writeFileSync(pathB, "shared-bytes")
    extractMetadata.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album", duration: 100, cover: null })

    // Fire both "add" events back-to-back without awaiting the first, exactly
    // like chokidar does - this is what used to race two inserts into two rows.
    await Promise.all([handlers.add(pathA), handlers.add(pathB)])

    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
    expect(db.prepare("SELECT * FROM track_locations").all()).toHaveLength(1)
  })

  it("records a second path with the same content as a location instead of a duplicate track", async () => {
    const pathA = path.join(tmpDir, "a.mp3")
    const pathB = path.join(tmpDir, "b.mp3")
    fs.writeFileSync(pathA, "shared-bytes")
    fs.writeFileSync(pathB, "shared-bytes")
    extractMetadata.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album", duration: 100, cover: null })

    await handlers.add(pathA)
    extractMetadata.mockClear()
    await handlers.add(pathB)

    expect(extractMetadata).not.toHaveBeenCalled()
    const tracks = db.prepare("SELECT * FROM tracks").all()
    expect(tracks).toHaveLength(1)
    const locations = db.prepare("SELECT * FROM track_locations").all()
    expect(locations).toEqual([expect.objectContaining({ track_id: tracks[0].id, file_path: pathB })])
  })

  it("does not resurrect a path that's already a location of another track (e.g. merged in by mergeMetadataDuplicates)", async () => {
    const canonicalId = db
      .prepare("INSERT INTO tracks (file_path, title, content_hash) VALUES (?, ?, ?)")
      .run(path.join(tmpDir, "canonical.mp3"), "Song", "hash-1").lastInsertRowid
    const locationPath = path.join(tmpDir, "already-merged.mp3")
    fs.writeFileSync(locationPath, "different-bytes-same-song")
    db.prepare("INSERT INTO track_locations (track_id, file_path, file_size) VALUES (?, ?, ?)").run(
      canonicalId,
      locationPath,
      fs.statSync(locationPath).size
    )

    await handlers.add(locationPath)

    expect(extractMetadata).not.toHaveBeenCalled()
    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
    expect(db.prepare("SELECT * FROM track_locations").all()).toHaveLength(1)
  })
})

describe("unlink handler", () => {
  it("just drops the location row when a secondary copy's path disappears", async () => {
    const pathA = path.join(tmpDir, "a.mp3")
    const pathB = path.join(tmpDir, "b.mp3")
    fs.writeFileSync(pathA, "shared-bytes")
    fs.writeFileSync(pathB, "shared-bytes")
    extractMetadata.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album", duration: 100, cover: null })

    await handlers.add(pathA)
    await handlers.add(pathB)

    handlers.unlink(pathB)

    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
    expect(db.prepare("SELECT * FROM track_locations").all()).toEqual([])
  })

  it("deletes the track when its only path disappears", async () => {
    const filePath = path.join(tmpDir, "song.mp3")
    fs.writeFileSync(filePath, "solo-bytes")
    extractMetadata.mockResolvedValue({ title: "Song", artist: "Artist", album: "Album", duration: 100, cover: null })

    await handlers.add(filePath)
    handlers.unlink(filePath)

    expect(db.prepare("SELECT * FROM tracks").all()).toEqual([])
  })
})
