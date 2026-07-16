import { describe, it, expect, vi, beforeEach } from "vitest"
import { dialog } from "electron"
import { createTestDb } from "../db/testDb.js"
import { scanFolder, countAudioFiles } from "./scanner.js"
import { watchFolders } from "./watcher.js"
import {
  addFolder,
  getFolders,
  removeFolder,
  rescanLibrary,
  getLastScanned,
  incrementPlayCount,
  getTopPlayedTracks,
  getRecentlyPlayed,
  getTopPlayedArtists,
  getTotalPlays,
  getArtistByName,
} from "./library.js"

vi.mock("./scanner.js", () => ({ scanFolder: vi.fn(), countAudioFiles: vi.fn(() => 0) }))
vi.mock("./watcher.js", () => ({ watchFolders: vi.fn() }))

let db
let fakeMainWindow

beforeEach(() => {
  db = createTestDb()
  vi.clearAllMocks()
  fakeMainWindow = { isDestroyed: () => false, webContents: { send: vi.fn() } }
})

describe("addFolder", () => {
  it("scans each selected folder and starts watching", async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/music/a", "/music/b"] })

    await addFolder(fakeMainWindow, db)

    expect(scanFolder).toHaveBeenCalledWith(db, "/music/a", expect.any(Function))
    expect(scanFolder).toHaveBeenCalledWith(db, "/music/b", expect.any(Function))
    expect(watchFolders).toHaveBeenCalledWith(db)
  })

  it("does nothing but return the current folders when the dialog is canceled", async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    const result = await addFolder(fakeMainWindow, db)

    expect(scanFolder).not.toHaveBeenCalled()
    expect(watchFolders).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it("merges same-metadata duplicates left behind by the scan, not just at app launch", async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/music/a"] })
    // scanFolder is mocked (it doesn't touch the DB here), so pre-seed the
    // rows it would otherwise have inserted: same title/album/artist, but
    // different content_hash, i.e. the case scanning by hash alone can't merge.
    db.prepare("INSERT INTO tracks (file_path, title, album, content_hash) VALUES (?, ?, ?, ?)").run(
      "/music/a/song-v1.flac",
      "Song",
      "Album",
      "hash-1"
    )
    db.prepare("INSERT INTO tracks (file_path, title, album, content_hash) VALUES (?, ?, ?, ?)").run(
      "/music/a/song-v2.flac",
      "Song",
      "Album",
      "hash-2"
    )

    await addFolder(fakeMainWindow, db)

    expect(db.prepare("SELECT * FROM tracks").all()).toHaveLength(1)
  })

  it("streams scan-progress events as the mocked scanFolder reports files processed", async () => {
    dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["/music/a"] })
    countAudioFiles.mockReturnValue(2)
    scanFolder.mockImplementation(async (_db, folder, onFile) => {
      onFile({ filePath: "/music/a/one.mp3" })
      onFile({ filePath: "/music/a/two.mp3" })
    })

    await addFolder(fakeMainWindow, db)

    expect(fakeMainWindow.webContents.send).toHaveBeenCalledWith("library:scan-progress", {
      phase: "add",
      current: 1,
      total: 2,
      pct: 50,
      message: "one.mp3",
      folderPath: "/music/a",
    })
    expect(fakeMainWindow.webContents.send).toHaveBeenCalledWith("library:scan-progress", {
      phase: "add",
      current: 2,
      total: 2,
      pct: 100,
      message: "two.mp3",
      folderPath: "/music/a",
    })
  })
})

describe("getFolders", () => {
  it("returns folders with their track count", () => {
    db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music")
    expect(getFolders(db)).toEqual([expect.objectContaining({ path: "/music", trackCount: 0 })])
  })
})

describe("removeFolder", () => {
  it("deletes the folder, its orphaned tracks and artists, and restarts the watcher", () => {
    const folderId = db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music").lastInsertRowid
    const artistId = db.prepare("INSERT INTO artists (name) VALUES (?)").run("Solo Artist").lastInsertRowid
    db.prepare(
      "INSERT INTO tracks (folder_id, artist_id, file_path, title) VALUES (?, ?, ?, ?)"
    ).run(folderId, artistId, "/music/a.mp3", "A")

    removeFolder(db, "/music")

    expect(getFolders(db)).toEqual([])
    expect(db.prepare("SELECT * FROM tracks").all()).toEqual([])
    expect(db.prepare("SELECT * FROM artists").all()).toEqual([])
    expect(watchFolders).toHaveBeenCalledWith(db)
  })

  it("promotes a surviving location instead of deleting the track when its primary copy's folder is removed", () => {
    const removedFolderId = db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music").lastInsertRowid
    db.prepare("INSERT INTO folders (path) VALUES (?)").run("/backup")
    const trackId = db
      .prepare("INSERT INTO tracks (folder_id, file_path, title, noOfPlays) VALUES (?, ?, ?, ?)")
      .run(removedFolderId, "/music/a.mp3", "A", 4).lastInsertRowid
    db.prepare("INSERT INTO track_locations (track_id, file_path) VALUES (?, ?)").run(trackId, "/backup/a.mp3")

    removeFolder(db, "/music")

    const tracks = db.prepare("SELECT * FROM tracks").all()
    expect(tracks).toEqual([expect.objectContaining({ id: trackId, file_path: "/backup/a.mp3", noOfPlays: 4 })])
    expect(db.prepare("SELECT * FROM track_locations").all()).toEqual([])
  })
})

describe("rescanLibrary", () => {
  it("scans every known folder and restarts the watcher", async () => {
    db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music/a")
    db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music/b")

    await rescanLibrary(fakeMainWindow, db)

    expect(scanFolder).toHaveBeenCalledWith(db, "/music/a", expect.any(Function))
    expect(scanFolder).toHaveBeenCalledWith(db, "/music/b", expect.any(Function))
    expect(watchFolders).toHaveBeenCalledWith(db)
  })

  it("streams scan-progress events with phase 'rescan'", async () => {
    db.prepare("INSERT INTO folders (path) VALUES (?)").run("/music/a")
    countAudioFiles.mockReturnValue(1)
    scanFolder.mockImplementation(async (_db, folder, onFile) => {
      onFile({ filePath: "/music/a/one.mp3" })
    })

    await rescanLibrary(fakeMainWindow, db)

    expect(fakeMainWindow.webContents.send).toHaveBeenCalledWith("library:scan-progress", {
      phase: "rescan",
      current: 1,
      total: 1,
      pct: 100,
      message: "one.mp3",
      folderPath: "/music/a",
    })
  })
})

describe("getLastScanned", () => {
  it("returns null when no folder has been scanned", () => {
    expect(getLastScanned(db)).toBeNull()
  })
})

describe("incrementPlayCount", () => {
  it("increments noOfPlays and sets last_played_at", () => {
    const trackId = db
      .prepare("INSERT INTO tracks (file_path, title) VALUES (?, ?)")
      .run("/a.mp3", "A").lastInsertRowid

    const result = incrementPlayCount(db, trackId)

    expect(result).toEqual({ success: true })
    const row = db.prepare("SELECT noOfPlays, last_played_at FROM tracks WHERE id = ?").get(trackId)
    expect(row.noOfPlays).toBe(1)
    expect(row.last_played_at).not.toBeNull()
  })
})

describe("getTopPlayedTracks / getRecentlyPlayed", () => {
  it("attaches an echovault:// cover URL derived from the stored cover path", async () => {
    const trackId = db
      .prepare(
        "INSERT INTO tracks (file_path, title, cover, noOfPlays, last_played_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .run("/a.mp3", "A", "/covers/a.jpg", 5).lastInsertRowid

    const top = await getTopPlayedTracks(db)
    const recent = await getRecentlyPlayed(db)

    expect(top).toEqual([expect.objectContaining({ id: trackId, coverDataUrl: "echovault:///covers/a.jpg" })])
    expect(recent).toEqual([expect.objectContaining({ id: trackId, coverDataUrl: "echovault:///covers/a.jpg" })])
  })

  it("returns null coverDataUrl when the track has no cover", async () => {
    db.prepare(
      "INSERT INTO tracks (file_path, title, noOfPlays, last_played_at) VALUES (?, ?, ?, datetime('now'))"
    ).run("/a.mp3", "A", 5)

    expect((await getTopPlayedTracks(db))[0].coverDataUrl).toBeNull()
  })
})

describe("getTopPlayedArtists", () => {
  it("sums plays per artist name, ordered highest first", () => {
    db.prepare("INSERT INTO tracks (file_path, title, artist, noOfPlays) VALUES (?, ?, ?, ?)").run(
      "/a.mp3",
      "A",
      "Artist A",
      3
    )
    db.prepare("INSERT INTO tracks (file_path, title, artist, noOfPlays) VALUES (?, ?, ?, ?)").run(
      "/b.mp3",
      "B",
      "Artist B",
      10
    )

    const result = getTopPlayedArtists(db)

    expect(result.map((a) => a.artist)).toEqual(["Artist B", "Artist A"])
  })
})

describe("getTotalPlays", () => {
  it("sums noOfPlays across all tracks", () => {
    db.prepare("INSERT INTO tracks (file_path, title, noOfPlays) VALUES (?, ?, ?)").run("/a.mp3", "A", 3)
    db.prepare("INSERT INTO tracks (file_path, title, noOfPlays) VALUES (?, ?, ?)").run("/b.mp3", "B", 4)

    expect(getTotalPlays(db)).toEqual({ totalPlays: 7 })
  })

  it("returns 0 when there are no tracks", () => {
    expect(getTotalPlays(db)).toEqual({ totalPlays: 0 })
  })
})

describe("getArtistByName", () => {
  it("returns the artist row matching the given name", () => {
    db.prepare("INSERT INTO artists (name, cover) VALUES (?, ?)").run("Artist A", "/covers/artist-a.jpg")

    expect(getArtistByName(db, "Artist A")).toEqual({ id: 1, cover: "/covers/artist-a.jpg" })
  })

  it("returns null when no artist matches", () => {
    expect(getArtistByName(db, "Nobody")).toBeNull()
  })
})
