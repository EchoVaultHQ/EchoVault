## 1. Fix the API host

- [x] 1.1 In `src/backend/utils/lrclibClient.js`, change `LRCLIB_ENDPOINT` from `https://lrclib.org/api/get` to `https://lrclib.net/api/get`.

## 2. Add User-Agent header

- [x] 2.1 In `lrclibClient.js`, add a `User-Agent` header (e.g. `EchoVault/<version> (+https://github.com/ACS-lessgo/EchoVault)`, pulling name/version from `package.json`) to the `fetch` call in `requestLrclib`.

## 3. Diagnostic failure reasons

- [x] 3.1 Refactor `requestLrclib` to return `{ lyrics, reason }`: `"ok"` on success, `"http-<status>"` on non-2xx, `"no-synced-lyrics"` on a 200 with no `syncedLyrics` field, `"network-error: <message>"` on a thrown fetch error, `"timeout"` on abort.
- [x] 3.2 Update `fetchLyricsFromLrclib` to propagate `{ lyrics, reason }` through the album-retry logic: return the hit's reason on success, or the album-less attempt's reason if both miss.
- [x] 3.3 In `src/backend/main/tracks.js`, log the reason on a miss (`lyrics :: online lookup :: miss (<reason>)`) and include the reason in the returned payload only when there are no lyrics.
- [x] 3.4 In `src/frontend/store/player.js`, include the reason in the existing "no lyrics found" console.log when present.
- [x] 3.5 Update `test_lrclibClient.mjs` for the new `{ lyrics, reason }` return shape (adjust existing assertions accordingly).

## 4. Verification

- [x] 4.1 Run `node src/backend/utils/test_lrclibClient.mjs` — confirm updated assertions pass.
- [ ] 4.2 Manually test: play "Believer" (or another mainstream track) → confirm synced lyrics now load via the online source, and a `.lrc` file is written next to it.
- [ ] 4.3 Manually test: play a track genuinely not on lrclib.net → confirm the miss reason logged is `no-synced-lyrics` or a 404-style reason, not a network error.
