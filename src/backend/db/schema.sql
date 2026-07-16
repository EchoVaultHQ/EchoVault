-- ============================
-- MAIN TABLES
-- ============================

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE,
  last_scanned_at TEXT
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

-- Extra copies of a song that already has a canonical row in `tracks`
-- (same content_hash, different file_path) live here instead of creating
-- a duplicate tracks row.
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

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  cover TEXT    
);

-- ============================
-- PLAYLIST TABLES
-- ============================

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cover TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT DEFAULT '',
  avatar_path TEXT
);