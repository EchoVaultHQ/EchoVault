## Why

A live test session surfaced two separate bugs while playing "Stellar - Bad Dream":

1. `win:set-immersive-mode` throws `TypeError: r.setResizeable is not a function` every time it fires. Root cause confirmed by inspection: `src/backend/main/window.js` calls `mainWindow.setResizeable(...)` (two call sites) — Electron's real `BrowserWindow` method is `setResizable`, correctly spelled elsewhere in this same codebase (`src/backend/main/player.js`). This is a pre-existing typo, unrelated to the lyrics work but caught in the same debugging session.
2. Lyrics still show "No lyrics found" for this track even after `fetch-online-lyrics` was implemented. Investigation confirmed the track's metadata is clean (artist "Stellar", title "Bad Dream", album "Bad Dream", duration 147.84s all parse correctly) and the app's local DB/file lookups are working as designed — no `.lrc` file, no embedded tags, so the online step is the one that should be finding this. Root cause: `lrclibClient.js` always sends `album_name` to lrclib.org's `/api/get`, which does strict field matching — if the tagged album differs at all from lrclib's canonical entry for the track (common for singles, reissues, or albums tagged inconsistently), the whole request 404s even though artist+title+duration alone would have matched. There's also no logging distinguishing "network failed" from "no match found" from "request malformed," so this class of miss is currently undebuggable from the app's own logs.

## What Changes

- Fix `src/backend/main/window.js`: rename both `setResizeable` calls to `setResizable`.
- `lrclibClient.js`: if the initial lookup (with `album_name`) returns no match, automatically retry once without `album_name` before giving up — matches the common integration pattern for lrclib.org's strict matching behavior.
- Add lightweight diagnostic logging (via the existing `electron-log`/`window.api.info` conventions already used elsewhere in the backend) around the lyrics fallback chain: log which step (`.lrc` / embedded / online) was attempted and its outcome, so a future "lyrics not found" report is diagnosable from logs instead of requiring a fresh investigation each time.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `online-lyrics-lookup` (from the in-progress `fetch-online-lyrics` change — not yet archived, so no formal spec file exists yet to diff against): the lookup gains an album-less retry step and outcome logging; the core requirements (fallback order, persistence, negative cache, settings toggle) are unchanged.

## Impact

- **Backend**: `src/backend/main/window.js` (typo fix, 2 lines), `src/backend/utils/lrclibClient.js` (retry logic), `src/backend/main/tracks.js` (logging additions only, no behavior change to the fallback chain itself).
- **No UI changes**, no new settings, no schema changes.
- **Depends on** `fetch-online-lyrics` being implemented first (already done in this session) — this change patches its lookup logic, not a standalone rewrite.
