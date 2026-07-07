## Why

EchoVault can already extract embedded ID3 lyrics tags (`extractEmbeddedLyrics` in `src/backend/utils/embeddedLyrics.js`), including SYLT (synchronized) timestamps, but nothing in the app ever displays them — the IPC handler discards the timestamp data and returns plain text only, and no frontend component renders lyrics at all. Real-world audio files almost never carry SYLT tags, so relying on embedded tags alone would make synced lyrics a rare occurrence. Adding `.lrc` sidecar file support (the de facto standard for synced lyrics distribution) makes the feature actually useful for most users' libraries.

## What Changes

- Add `.lrc` sidecar file lookup (same basename as the audio file) as the primary lyrics source, parsed into `[mm:ss.xx]` timestamped lines.
- Fall back to embedded ID3 tags (existing `extractEmbeddedLyrics`) when no `.lrc` file exists, using its SYLT timestamps when present or USLT/TXXX plain text otherwise.
- Fix `tracks:get-embedded-lyrics` IPC handler (`src/backend/main/tracks.js`) to return the full lyrics payload (`{ text, timestamps, synchronized, source }`) instead of just a string.
- Add a lyrics panel to `ImmersiveMode.vue`: auto-scrolling, current-line-highlighted display when timestamps are available; static scrollable text when only plain lyrics exist; a small "No lyrics found" placeholder otherwise.
- Drive line highlighting off the existing `player.currentTime` reactive state (already updated every 200ms by the progress updater in `src/frontend/store/player.js`) — no new polling loop.
- Update `player.js` store's `getLyrics()` action to store the structured payload and fetch automatically whenever `currentTrack` changes.

## Capabilities

### New Capabilities
- `synced-lyrics`: Loading, parsing, and displaying time-synced (or plain-text-fallback) lyrics for the currently playing track, sourced from `.lrc` sidecar files or embedded ID3 tags.

### Modified Capabilities
(none — no existing specs cover lyrics; this is greenfield)

## Impact

- **Backend**: `src/backend/main/tracks.js` (IPC handler return shape), new `src/backend/utils/lrcParser.js`, `src/backend/utils/embeddedLyrics.js` (consumed as-is, no change needed).
- **Preload**: `src/preload.js` — response shape of `getEmbeddedLyrics` changes (internal API, no external consumers besides the renderer store).
- **Frontend**: `src/frontend/store/player.js` (`lyrics` state shape + auto-fetch), `src/frontend/components/ImmersiveMode.vue` (new lyrics panel UI + scoped styles).
- **No DB schema changes** — lyrics are resolved live from filesystem/tags, not persisted.
- **No new dependencies** — `.lrc` parsing is a small regex-based parser, no library needed.
