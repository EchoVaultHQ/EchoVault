import { app } from "electron"
import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import log from "../../logger"

export function initDB(dbPath = path.join(app.getPath("userData"), "sonicbox.db")) {
  log.info("InitDB :: Start")
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL") // Write-Ahead Logging
  db.pragma("foreign_keys = ON") // Enforce foreign key constraints

  log.info(
    "InitDB :: Foreign keys:",
    db.pragma("foreign_keys", { simple: true })
  )

  const possibleSchemaPaths = [
    process.resourcesPath ? path.join(process.resourcesPath, "schema.sql") : null, // for packaged app
    path.join(__dirname, "schema.sql"), // for dev build
    path.join(app.getAppPath(), "schema.sql"), // fallback
  ].filter(Boolean)

  let schema = null
  for (const p of possibleSchemaPaths) {
    if (fs.existsSync(p)) {
      schema = fs.readFileSync(p, "utf-8")
      break
    }
  }

  if (!schema) {
    console.warn("Schema.sql not found — using FALLBACK.")
    schema = `
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE,
        last_scanned_at TEXT
      );

      CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        cover TEXT
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER,
        artist_id INTEGER,
        file_path TEXT UNIQUE,
        title TEXT,
        album TEXT,
        artist TEXT,
        duration REAL,
        cover TEXT,
        isLiked INTEGER DEFAULT 0,
        isEnhanced INTEGER DEFAULT 0,
        noOfPlays INTEGER DEFAULT 0,
        last_played_at TEXT,
        file_size INTEGER,
        content_hash TEXT,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS track_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        folder_id INTEGER,
        file_path TEXT UNIQUE,
        file_size INTEGER,
        added_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
      );
    `
  }

  db.exec(schema)

  // Existing installs predate the last_played_at column — CREATE TABLE IF NOT EXISTS
  // won't add it, so migrate it in directly. Fails harmlessly if already present.
  try {
    db.exec("ALTER TABLE tracks ADD COLUMN last_played_at TEXT")
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err
  }

  try {
    db.exec("ALTER TABLE tracks ADD COLUMN file_size INTEGER")
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err
  }

  try {
    db.exec("ALTER TABLE tracks ADD COLUMN isEnhanced INTEGER DEFAULT 0")
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err
  }

  try {
    db.exec("ALTER TABLE folders ADD COLUMN last_scanned_at TEXT")
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err
  }

  try {
    db.exec("ALTER TABLE tracks ADD COLUMN content_hash TEXT")
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err
  }

  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_tracks_title_lower ON tracks(LOWER(title));`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_artist_lower ON tracks(LOWER(artist));`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_album_lower ON tracks(LOWER(album));`,

    `CREATE INDEX IF NOT EXISTS idx_tracks_folder_id ON tracks(folder_id);`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks(file_path);`,
    `CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_plays ON tracks(noOfPlays DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_tracks_content_hash ON tracks(content_hash);`,
    `CREATE INDEX IF NOT EXISTS idx_track_locations_track_id ON track_locations(track_id);`,
  ]

  for (const stmt of indexStatements) {
    db.prepare(stmt).run()
  }

  log.info("InitDB :: SQLite initialized at :: End :: ", dbPath)
  return db
}
