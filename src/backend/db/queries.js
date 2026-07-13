//  Folders
export const GET_FOLDERS_WITH_TRACK_COUNT = `
  SELECT f.*, COUNT(t.id) AS trackCount, COALESCE(SUM(t.file_size), 0) AS totalSize
  FROM folders f
  LEFT JOIN tracks t ON f.id = t.folder_id
  GROUP BY f.id
`
export const UPDATE_FOLDER_LAST_SCANNED = `
  UPDATE folders SET last_scanned_at = datetime('now') WHERE id = ?
`
export const GET_LAST_SCANNED_AT = `
  SELECT MAX(last_scanned_at) AS lastScannedAt FROM folders
`
export const DELETE_FOLDER = `DELETE FROM folders WHERE path=?`
export const CLEAN_ORPHAN_TRACKS = `
  DELETE FROM tracks WHERE folder_id NOT IN (SELECT id FROM folders)
`
export const GET_FOLDER_PATHS = `SELECT path FROM folders`
export const INSERT_FOLDER_IF_NOT_EXISTS = `
  INSERT OR IGNORE INTO folders (path) VALUES (?)
`
export const GET_FOLDER_ID_BY_PATH = `
  SELECT id FROM folders WHERE path=?
`

//  Tracks
export const GET_TRACKS = `SELECT * FROM tracks ORDER BY LOWER(title)`
export const GET_RECENT_TRACKS = `SELECT * FROM tracks ORDER BY id DESC LIMIT 15`
export const GET_LIKED_TRACKS = `SELECT * FROM tracks WHERE isLiked=1 ORDER BY LOWER(title)`
export const UPDATE_LIKE = `UPDATE tracks SET isLiked = ? WHERE id = ?`
export const GET_ENHANCED_TRACKS = `SELECT * FROM tracks WHERE isEnhanced=1 ORDER BY LOWER(title)`
export const MARK_TRACK_ENHANCED = `UPDATE tracks SET isEnhanced = 1 WHERE file_path = ?`
export const DELETE_TRACK_BY_PATH = `DELETE FROM tracks WHERE file_path=?`
export const GET_TRACK_PATHS_BY_FOLDER = `
  SELECT file_path FROM tracks WHERE folder_id=?
`
export const CHECK_TRACK_EXISTS = `
  SELECT 1 FROM tracks WHERE file_path=?
`
export const GET_TRACK_BY_ID = `SELECT * FROM tracks WHERE id=?`
export const GET_TRACK_BY_PATH = `SELECT * FROM tracks WHERE file_path=?`
export const UPSERT_TRACK = `
  INSERT INTO tracks (
    folder_id, artist_id, file_path, title, album, artist, duration, cover, file_size
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(file_path) DO UPDATE SET
    folder_id=excluded.folder_id,
    artist_id=excluded.artist_id,
    title=excluded.title,
    album=excluded.album,
    artist=excluded.artist,
    duration=excluded.duration,
    cover=excluded.cover,
    file_size=excluded.file_size
`
// queries

export const GET_ORDERED_TRACKS = `
  SELECT * FROM tracks 
  ORDER BY title ASC 
  LIMIT ?
`
export const SEARCH_TRACKS = `
  SELECT *
  FROM tracks
  WHERE LOWER(title) LIKE ?
     OR LOWER(artist) LIKE ?
     OR LOWER(album) LIKE ?
  ORDER BY LOWER(title)
`
export const SEARCH_TRACKS_BY_ARTIST = `
  SELECT *
  FROM tracks
  WHERE artist_id = ?
    AND (
      LOWER(title) LIKE ?
      OR LOWER(artist) LIKE ?
      OR LOWER(album) LIKE ?
    )
  ORDER BY LOWER(title)
`
export const SEARCH_ARTISTS = `
  SELECT *
  FROM artists
  WHERE LOWER(name) LIKE ?
  ORDER BY LOWER(name)
`
export const SEARCH_PLAYLISTS = `
  SELECT p.*, COUNT(pt.track_id) as track_count
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
  WHERE LOWER(p.name) LIKE ?
  GROUP BY p.id
  ORDER BY p.created_at DESC
`

//  Artists
export const GET_ARTISTS = `SELECT * FROM artists ORDER BY name`
export const GET_TRACKS_BY_ARTIST = `
  SELECT * FROM tracks
  WHERE artist_id = ?
  ORDER BY album, title
`
export const INSERT_ARTIST_IF_NOT_EXISTS = `
  INSERT OR IGNORE INTO artists (name) VALUES (?)
`
export const GET_ARTIST_BY_NAME = `
  SELECT id, cover FROM artists WHERE name=?
`
export const UPDATE_ARTIST_COVER = `
  UPDATE artists SET cover=? WHERE id=?
`
export const DELETE_ARTIST_WITHOUT_TRACKS = `
  DELETE FROM artists
  WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)
`
// Play Count
export const INCREMENT_PLAY_COUNT = `
  UPDATE tracks SET noOfPlays = noOfPlays + 1, last_played_at = datetime('now') WHERE id = ?
`

export const GET_RECENTLY_PLAYED = `
  SELECT * FROM tracks
  WHERE last_played_at IS NOT NULL
  ORDER BY last_played_at DESC
  LIMIT 6
`

export const GET_TOP_PLAYED_TRACKS = `
  SELECT * FROM tracks 
  WHERE noOfPlays > 0
  ORDER BY noOfPlays DESC 
  LIMIT 10
`

export const GET_TOP_PLAYED_ARTISTS = `
  SELECT 
    artist, 
    SUM(noOfPlays) as totalPlays,
    COUNT(*) as trackCount
  FROM tracks 
  WHERE artist IS NOT NULL AND noOfPlays > 0
  GROUP BY artist 
  ORDER BY totalPlays DESC 
  LIMIT 10
`

export const GET_TOTAL_PLAYS = `
  SELECT SUM(noOfPlays) as totalPlays FROM tracks
`

//  Profile
export const GET_PROFILE = `SELECT username, avatar_path FROM profile WHERE id = 1`
export const UPSERT_PROFILE_USERNAME = `
  INSERT INTO profile (id, username) VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET username = excluded.username
`
export const UPSERT_PROFILE_AVATAR = `
  INSERT INTO profile (id, avatar_path) VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET avatar_path = excluded.avatar_path
`
