import {
  GET_LOCATION_BY_PATH,
  DELETE_TRACK_LOCATION_BY_PATH,
  DELETE_TRACK_LOCATION_BY_ID,
  GET_TRACK_BY_PATH,
  GET_TRACK_BY_ID,
  GET_ONE_LOCATION_BY_TRACK,
  PROMOTE_LOCATION_TO_PRIMARY,
  DELETE_TRACK_BY_PATH,
  DELETE_TRACK_BY_ID,
  UPDATE_TRACK_MERGED_STATS,
  REPOINT_PLAYLIST_TRACKS,
  REPOINT_TRACK_LOCATIONS,
  INSERT_TRACK_LOCATION,
  GET_METADATA_DUPLICATE_GROUPS,
} from "../db/queries.js"

// Scanning and watching both hash a file (async I/O) before deciding whether
// it's a new track, an existing one, or a duplicate of one already seen -
// if two callers for identical content interleave during that hash/parse
// wait, both can observe "no match yet" and insert separate tracks. Routing
// every decide-and-write step through this single queue makes them atomic
// relative to each other, at the cost of no longer hashing files in
// parallel. ponytail: full serialization, add per-hash locking instead if
// large-library scan time becomes a real problem.
let queue = Promise.resolve()
export function serialized(fn) {
  const run = queue.then(fn, fn)
  queue = run.then(
    () => {},
    () => {}
  )
  return run
}

/**
 * Called whenever a path disappears from disk (watcher "unlink", scanner's
 * missing-file sweep, a folder being removed). Preserves play stats by
 * promoting a surviving copy to primary instead of hard-deleting the track.
 */
export function promoteLocationOrDeleteTrack(db, filePath) {
  const location = db.prepare(GET_LOCATION_BY_PATH).get(filePath)
  if (location) {
    db.prepare(DELETE_TRACK_LOCATION_BY_PATH).run(filePath)
    return
  }

  const track = db.prepare(GET_TRACK_BY_PATH).get(filePath)
  if (!track) return

  const other = db.prepare(GET_ONE_LOCATION_BY_TRACK).get(track.id)
  if (other) {
    db.prepare(PROMOTE_LOCATION_TO_PRIMARY).run(other.folder_id, other.file_path, other.file_size, track.id)
    db.prepare(DELETE_TRACK_LOCATION_BY_ID).run(other.id)
  } else {
    db.prepare(DELETE_TRACK_BY_PATH).run(filePath)
  }
}

/**
 * Folds `duplicate` into `canonical` (caller passes canonical = lower id,
 * i.e. the earlier-created row). Stats, playlist membership, and any
 * locations already hanging off the duplicate all move to canonical, then
 * duplicate's own path becomes a location, then the duplicate row is deleted.
 */
export function mergeTrackIntoCanonical(db, canonical, duplicate) {
  const merge = db.transaction((canonical, duplicate) => {
    const noOfPlays = (canonical.noOfPlays || 0) + (duplicate.noOfPlays || 0)
    const isLiked = canonical.isLiked || duplicate.isLiked ? 1 : 0
    const isEnhanced = canonical.isEnhanced || duplicate.isEnhanced ? 1 : 0
    const lastPlayedAt =
      [canonical.last_played_at, duplicate.last_played_at].filter(Boolean).sort().at(-1) || null

    db.prepare(UPDATE_TRACK_MERGED_STATS).run(noOfPlays, isLiked, isEnhanced, lastPlayedAt, canonical.id)
    db.prepare(REPOINT_PLAYLIST_TRACKS).run(canonical.id, duplicate.id)
    db.prepare(REPOINT_TRACK_LOCATIONS).run(canonical.id, duplicate.id)
    db.prepare(INSERT_TRACK_LOCATION).run(canonical.id, duplicate.folder_id, duplicate.file_path, duplicate.file_size)
    db.prepare(DELETE_TRACK_BY_ID).run(duplicate.id)
  })

  merge(canonical, duplicate)
}

/**
 * One-time-per-launch sweep for tracks that share title+album+artist but were
 * never merged by content hash because their bytes genuinely differ (different
 * rip/bitrate/encode with identical tags). User opted into merging these on
 * metadata match despite the false-merge risk for real remasters/live versions
 * with identical tags - ponytail: no undo path if that risk hits, revisit with
 * a duration/size guard or a manual review list if merges turn out wrong.
 */
export function mergeMetadataDuplicates(db) {
  const groups = db.prepare(GET_METADATA_DUPLICATE_GROUPS).all()

  for (const group of groups) {
    const ids = group.ids
      .split(",")
      .map(Number)
      .sort((a, b) => a - b)
    const canonicalId = ids[0]

    for (const duplicateId of ids.slice(1)) {
      const canonical = db.prepare(GET_TRACK_BY_ID).get(canonicalId)
      const duplicate = db.prepare(GET_TRACK_BY_ID).get(duplicateId)
      if (!canonical || !duplicate) continue
      mergeTrackIntoCanonical(db, canonical, duplicate)
    }
  }
}
