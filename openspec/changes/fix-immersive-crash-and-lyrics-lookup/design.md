## Context

Both bugs were found in the same manual test session for `fetch-online-lyrics`. The window-resize crash is a simple pre-existing typo. The lyrics miss required tracing actual track metadata (via the app's SQLite DB and `music-metadata`) to rule out a local-data problem before concluding the issue is in how `lrclibClient.js` queries lrclib.org.

## Goals / Non-Goals

**Goals:**
- Stop the `win:set-immersive-mode`/`win:reset-immersive-mode` crash.
- Improve lrclib.org match rate for tracks whose tagged album doesn't exactly match lrclib's canonical album field.
- Make future "lyrics not found" reports diagnosable from logs alone.

**Non-Goals:**
- No change to the fallback order or persistence behavior established in `sync-lyrics-display`/`fetch-online-lyrics`.
- No fuzzy/partial-match logic beyond the one album-less retry — if artist+title+duration alone still don't match, it's a genuine "not in lrclib's database" case, not a bug.
- No UI surfacing of *why* a lookup failed (still a silent placeholder) — only backend logs change.

## Decisions

**1. `window.js` typo fix is a direct rename, no behavior change.**
`setResizeable` → `setResizable` at both call sites. `player.js` already uses the correct spelling for the same underlying need (disabling resize during mini-player mode), confirming this is purely a typo, not an intentional different code path.

**2. `lrclibClient.js` retries once without `album_name` on an initial miss, rather than never sending it or always omitting it.**
Sending `album_name` first is still worth attempting — it disambiguates same-titled tracks by different artists/albums when it *does* match, reducing false-positive matches. But treating a miss-with-album as final throws away correct matches where only the album metadata is inconsistent. A single automatic retry (album-qualified first, unqualified second) balances precision against recall without adding a new setting or UI. Alternative considered: never send `album_name` — rejected, loses a useful disambiguation signal for the common case where it matches.

**3. Logging goes through the existing `electron-log` instance already used in this codebase (`src/logger.js` pattern, `window.api.info` in the renderer), not a new logging mechanism.**
One line per fallback step attempted (`.lrc` checked → hit/miss, embedded checked → hit/miss, online checked → hit/miss/error) inside `tracks:get-lyrics`. This mirrors the verbosity level `player.js`'s existing `window.api.info` calls already use elsewhere (e.g. "Stopping previous track", "Playing track") — consistent with, not additive to, the codebase's existing logging density.

## Risks / Trade-offs

- **Retry doubles request count on album-mismatched tracks** — acceptable, this only happens on a genuine first-attempt miss, and the result is cached (session-negative-cache from `fetch-online-lyrics`, plus the `.lrc` write-back on success) so it's a one-time cost per track, not a recurring one.
- **Added logging increases log volume slightly** — matches existing verbosity conventions already present in `player.js`; not expected to be noticeably noisier than current logging.
