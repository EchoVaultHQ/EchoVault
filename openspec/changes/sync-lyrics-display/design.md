## Context

Two lyrics sources already exist in the codebase but are disconnected from any UI:
- `src/backend/utils/embeddedLyrics.js` — parses ID3/Vorbis/APE tags (USLT, SYLT, TXXX) via `music-metadata`, already returns `{ type, text, timestamps?, synchronized }` when it finds something.
- `src/backend/main/tracks.js` handler `tracks:get-embedded-lyrics` — calls the above but discards everything except `.text`, so timestamps never reach the renderer.
- `src/frontend/store/player.js` action `getLyrics()` — calls the IPC channel, stores the raw string in `this.lyrics`, but no component reads `player.lyrics` anywhere.

No component displays lyrics today. `ImmersiveMode.vue` is the natural home (full-screen, already shows artwork/track info/progress) and was confirmed as the target surface.

## Goals / Non-Goals

**Goals:**
- Resolve lyrics per track from `.lrc` sidecar file first, embedded ID3 tags second.
- Parse `.lrc` `[mm:ss.xx]` line timestamps into the same `{ time, text }` shape `embeddedLyrics.js` already uses for SYLT, so the frontend has one shape to render regardless of source.
- Render in `ImmersiveMode.vue`: auto-scroll + highlight current line when timestamps exist, static scroll when only plain text exists, small placeholder when nothing is found.
- Keep it live-computed — no persistence, no DB changes, no caching layer beyond what's already in memory for the current track.

**Non-Goals:**
- Online lyrics lookup (e.g. lrclib.org) — explicitly deferred, not part of this change.
- Manual sync-offset adjustment UI (some `.lrc` files drift a few hundred ms) — noted as a future enhancement, not built now.
- Lyrics editing, saving, or multi-language selection.
- Displaying lyrics anywhere other than Immersive Mode (e.g. no queue-sidebar tab, no dedicated route).

## Decisions

**1. Rename IPC channel `tracks:get-embedded-lyrics` → `tracks:get-lyrics`.**
The old name is now inaccurate (`.lrc` isn't embedded). Only three call sites exist (`preload.js`, `tracks.js`, `player.js`), so the rename is cheap and keeps the API self-describing. Alternative considered: keep the old name to minimize diff — rejected, the naming would actively mislead future readers.

**2. `.lrc` lookup is a straight sibling-file check, no fuzzy matching.**
Given track file path `/music/Artist/Song.mp3`, check for `/music/Artist/Song.lrc` (same basename, `.lrc` extension) via `fs.existsSync` + read. This matches the universal convention used by every other player (foobar2000, VLC, Musicbee). No recursive directory scanning, no fuzzy title matching — keeps it O(1) and predictable.

**3. New backend module `src/backend/utils/lrcParser.js`, mirrors `embeddedLyrics.js`'s output shape.**
Parses lines matching `/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/`, supports multiple leading timestamp tags on one line (e.g. `[00:12.00][00:45.00]text`), ignores metadata tags (`[ar:]`, `[ti:]`, `[by:]`, etc. — anything non-numeric after `[`). Returns `{ timestamps: [{time, text}], text: <joined plain text>, synchronized: true }` or `null` if the file has no valid timestamp lines (treated as "no `.lrc` lyrics", falls through to embedded-tag lookup rather than showing an empty synced view).

**4. Resolution order lives in `tracks.js`'s handler, not spread across layers.**
`tracks:get-lyrics` handler tries `lrcParser` first; if it returns `null`, falls back to `extractEmbeddedLyrics`; if that also returns nothing, responds with `{ text: null, timestamps: null, synchronized: false, source: null }`. One place owns the fallback chain, easy to reorder or extend (e.g. inserting online lookup later) without touching the frontend.

**5. `player.js` fetches lyrics automatically inside `setTrack()`, not via a watcher.**
`setTrack()` already resets `this.lyrics = null` per track change. Adding `await this.getLyrics()` there (non-blocking — fire-and-forget, don't block playback start on lyrics I/O) keeps lyrics fetching co-located with track-change logic. This is an options-style Pinia store (not `<script setup>`), so a `watch()` on `currentTrack` would need extra wiring a component would have to own; doing it inside the action that already owns the transition is simpler and matches the store's existing pattern (`this.lyrics = null` is already there).

**6. Active-line lookup is a linear scan over `player.currentTime`, not binary search.**
Lyrics timestamp arrays are at most a few hundred entries (full song, line-by-line). A linear `findLast(ts => ts.time <= currentTime)` per 200ms tick (driven by the existing progress updater interval) is trivially cheap. Binary search would be premature optimization for this data size.

## Risks / Trade-offs

- **`.lrc` encoding variance** (UTF-8 BOM, occasionally UTF-16 on older rips) → strip a leading BOM before parsing; if parsing yields zero valid lines, fall back to embedded tags rather than erroring.
- **Drift between `.lrc` timestamps and actual playback** (common with re-encoded/trimmed files) → out of scope per Non-Goals; a future manual-offset slider is the natural follow-up, not built here.
- **Renaming the IPC channel** touches 3 files but is a synchronous, mechanical rename — low risk, verified by grep before/after.
- **`music-metadata` re-parses the whole file's tags on every lyrics request** (existing behavior, not changed by this proposal) — acceptable since it already happens today for the (currently unused) embedded path; not a new cost introduced by this change.
