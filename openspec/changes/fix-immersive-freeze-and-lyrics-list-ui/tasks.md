## 1. Fix Immersive Mode freeze

- [x] 1.1 In `src/backend/main/window.js`, remove `mainWindow.setResizable(false)` from `win:set-immersive-mode` and `mainWindow.setResizable(true)` from `win:reset-immersive-mode` — keep only the `setFullScreen` calls.

## 2. Renderer console logging for lyrics

- [x] 2.1 In `src/frontend/store/player.js`'s `getLyrics()`, add `console.log` calls: log the resolved `source` ("lrc"/"embedded"/"online"/null) and whether lyrics were found, right after `window.api.getLyrics(...)` resolves.

## 3. Restyle lyrics panel as a row list

- [x] 3.1 In `ImmersiveMode.vue`, replace the centered `.lyrics-panel`/`.lyric-line` markup with a row-list structure mirroring `QueueSidebar.vue`'s `.queue-item` pattern: numbered rows (`.lyric-row` with an index or time label), scrollable container.
- [x] 3.2 Port the row styling (alternating background, hover, active-row highlight) from `.queue-item`/`.queue-item.playing` conventions, adapted for the lyrics panel's placement/sizing in Immersive Mode.
- [x] 3.3 Keep unsynced (plain-text) lyrics and the "no lyrics" placeholder consistent with the new row-list look (each line as a row, no active highlight) rather than reverting to the old centered-text block for that case.
- [x] 3.4 Verify auto-scroll-to-active-line behavior (from `sync-lyrics-display`) still works against the new row markup (same `setLyricRef`/`scrollIntoView` mechanism, updated element selector if the row wrapper changed).

## 4. Verification

- [ ] 4.1 Manually test: toggle Immersive Mode on/off repeatedly → confirm no freeze, window stays responsive and correctly sized/positioned.
- [ ] 4.2 Manually test: play a track, open DevTools console → confirm a log line shows the lyrics source/outcome.
- [ ] 4.3 Manually test: visually compare the lyrics panel against the Queue sidebar → confirm row style (numbering, alternating background, active-row highlight) matches the established convention.
