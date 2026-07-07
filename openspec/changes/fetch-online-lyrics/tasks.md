## 1. Backend: lrclib.org client

- [x] 1.1 Create `src/backend/utils/lrclibClient.js` exporting `fetchLyricsFromLrclib({ artist, title, album, duration })`: builds `GET https://lrclib.org/api/get` with query params `artist_name`, `track_name`, `album_name` (omit if absent), `duration`; uses `AbortController` with a ~5s timeout.
- [x] 1.2 Map a successful response's `syncedLyrics` field through the existing `parseLrc` (from `sync-lyrics-display`) to produce the standard `{ timestamps, text, synchronized: true }` shape; return `null` on non-200, no match, network error, timeout, or parse failure — never throw.
- [x] 1.3 Add a small manual/self-check covering: successful match maps correctly, 404/no-match returns `null`, simulated network error returns `null` (not a throw).

## 2. Backend: wire into fallback chain + persistence

- [x] 2.1 In `src/backend/main/tracks.js`'s `tracks:get-lyrics` handler, after the existing `.lrc` → embedded-tags chain both come up empty: check `localStorage`-equivalent setting is not directly readable from main process — read the setting via an IPC-passed flag or a shared preference file (resolve exact mechanism against how `Setting.vue`/renderer currently exposes toggles to main, if at all; if no such bridge exists yet, pass the current setting value as an argument from the renderer call site instead of having the main process read `localStorage` directly).
- [x] 2.2 If online lookup is enabled and not session-negative-cached for this `file_path`, call `fetchLyricsFromLrclib` with the track's artist/title/album/duration.
- [x] 2.3 On a match: write the result to `<basename>.lrc` next to the source file (reuse the sibling-path derivation from `sync-lyrics-display`'s `.lrc` lookup), tag the returned payload `source: "online"`, and return it even if the write fails (catch and log write errors separately from lookup errors).
- [x] 2.4 On no match or failure: record the `file_path` in a module-scoped in-memory `Map`/`Set` (cleared naturally on app restart) so this session doesn't re-query the same track, then return the existing `{ text: null, timestamps: null, synchronized: false, source: null }` empty result.

## 3. Settings: online lookup toggle

- [x] 3.1 Add a `fetchLyricsOnline` preference following the exact `localStorage` pattern used by `src/frontend/store/theme.js`/`accent.js` (default `"true"` when unset).
- [x] 3.2 Add a toggle row to `Setting.vue` ("Fetch lyrics online") wired to that preference, matching the visual style of existing toggles in that component.
- [x] 3.3 Wire the renderer call to `window.api.getLyrics(...)` (or a new params-carrying variant) to pass the current toggle state through to the main-process handler per task 2.1's resolved mechanism.

## 4. Verification

- [ ] 4.1 Manually test: track with no local lyrics, setting enabled, track exists on lrclib.org → synced lyrics appear, a `.lrc` file is created next to the source file.
- [ ] 4.2 Manually test: replay the same track → lyrics load from the new local `.lrc` file, confirm (e.g. via a temporary log or network panel) no repeat network request fires.
- [ ] 4.3 Manually test: track not found on lrclib.org → "No lyrics found" placeholder, no error toast, no crash.
- [ ] 4.4 Manually test: disable "Fetch lyrics online" in Settings, then play a track with no local lyrics → no network request fires, placeholder shown immediately.
- [ ] 4.5 Manually test: disconnect network, play a track with no local lyrics → placeholder shown after the timeout window, no hang, no error surfaced beyond the placeholder.
