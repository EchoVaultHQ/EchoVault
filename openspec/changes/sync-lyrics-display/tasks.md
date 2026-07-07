## 1. Backend: LRC parsing

- [x] 1.1 Create `src/backend/utils/lrcParser.js` exporting `parseLrc(lrcText)`: strips a leading BOM, matches `/^((?:\[\d{2}:\d{2}\.\d{2,3}\])+)(.*)$/` per line, expands multi-timestamp lines into separate `{ time, text }` entries, ignores non-timestamp metadata lines (`[ar:...]`, `[ti:...]`, etc.), returns `{ timestamps, text, synchronized: true }` sorted by time, or `null` if zero valid timestamp lines were found.
- [x] 1.2 Add a small manual/self-check (e.g. `if (import.meta.url === ...)` guard or a `test_lrcParser.js`) covering: single timestamp line, multi-timestamp line, metadata-only file (expect `null`), BOM-prefixed file.

## 2. Backend: lyrics resolution + IPC

- [x] 2.1 In `src/backend/main/tracks.js`, add an `.lrc` sibling-file lookup: derive `<file_path without ext>.lrc` via `path`, `fs.existsSync` + `fs.readFileSync` (utf-8), pass content to `parseLrc`.
- [x] 2.2 Rename the IPC handler `tracks:get-embedded-lyrics` → `tracks:get-lyrics`. Implement the fallback chain: `.lrc` result (2.1) → `extractEmbeddedLyrics` (existing) → `{ text: null, timestamps: null, synchronized: false, source: null }`. Tag the resolved result with `source: "lrc"` or `source: "embedded"` accordingly.
- [x] 2.3 Update `src/preload.js`: rename `getEmbeddedLyrics` → `getLyrics`, same channel rename (`tracks:get-lyrics`).

## 3. Frontend: store wiring

- [x] 3.1 In `src/frontend/store/player.js`, update `getLyrics()` to call `window.api.getLyrics(...)` and store the full structured payload (`{ text, timestamps, synchronized, source }`) in `this.lyrics`, not just a string.
- [x] 3.2 Call `this.getLyrics()` from within `setTrack()` (after `this.lyrics = null` reset, non-blocking — don't `await` before `playTrack()`), so lyrics load automatically per track change.

## 4. Frontend: Immersive Mode lyrics panel

- [x] 4.1 Add a lyrics panel section to `ImmersiveMode.vue` template (e.g. beside/below `.track-info-center`), reading `player.lyrics`.
- [x] 4.2 Add a computed `activeLyricIndex` that scans `player.lyrics.timestamps` for the last entry with `time <= player.currentTime` (linear scan, recompute on `currentTime` changes — already ticking every 200ms via the existing progress updater).
- [x] 4.3 Render synchronized lyrics as a scrollable list with the active line highlighted (`.lyric-line.active` class); render plain (`synchronized: false`) lyrics as static scrollable text; render a "No lyrics found" placeholder when `player.lyrics?.text` is null/empty.
- [x] 4.4 Auto-scroll the active line into view when `activeLyricIndex` changes (e.g. `scrollIntoView({ block: "center", behavior: "smooth" })` on the active line element via a `watch`).
- [x] 4.5 Add scoped styles for the lyrics panel consistent with existing Immersive Mode glassmorphism/theme-variable conventions already used in the component.

## 5. Verification

- [ ] 5.1 Manually test: track with a matching `.lrc` file → synced highlight tracks playback and seeking.
- [ ] 5.2 Manually test: track with embedded SYLT tag, no `.lrc` file → synced highlight works from embedded source.
- [ ] 5.3 Manually test: track with only unsynced/USLT lyrics → static scrollable text, no highlight.
- [ ] 5.4 Manually test: track with no lyrics at all → placeholder shown, no console errors.
- [ ] 5.5 Manually test: switching tracks mid-playback clears the previous track's lyrics before the new ones load.
