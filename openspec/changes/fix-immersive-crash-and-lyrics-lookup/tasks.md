## 1. Fix window-resize crash

- [x] 1.1 In `src/backend/main/window.js`, rename both `mainWindow.setResizeable(...)` calls (lines ~24 and ~31) to `mainWindow.setResizable(...)`.

## 2. Fix lrclib.org album-mismatch false negatives

- [x] 2.1 In `src/backend/utils/lrclibClient.js`, refactor the single request into a helper that performs one lrclib.org GET given a params object, then call it twice: once with `album_name` included, and — only if that returns no match — once more without it. Return the first hit, or `null` if both miss.
- [x] 2.2 Update/extend `test_lrclibClient.mjs` to cover: album-qualified miss + album-less hit returns the retry's result; both missing still returns `null`.

## 3. Add fallback-chain diagnostic logging

- [x] 3.1 In `src/backend/main/tracks.js`'s `tracks:get-lyrics` handler, add a log line (via the existing `electron-log`/logger convention used elsewhere in the backend) after each fallback step reporting hit/miss: `.lrc` check, embedded-tag check, online lookup (including whether the album-less retry was needed).

## 4. Verification

- [x] 4.1 Run `node src/backend/utils/test_lrclibClient.mjs` — confirm the new retry-path assertions pass.
- [ ] 4.2 Manually test: trigger Immersive Mode toggle → confirm no `setResizeable` error in the console/logs.
- [ ] 4.3 Manually test: replay "Stellar - Bad Dream" (or another track with an inconsistently-tagged album) → check logs to confirm which fallback step ran and its outcome; confirm lyrics now appear if lrclib.org has the track under any album value.
