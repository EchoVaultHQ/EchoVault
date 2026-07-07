## Why

"Imagine Dragons - Believer" — one of the most-streamed songs in existence, certain to have synced lyrics on lrclib.org — returned an online lookup miss, and the user reported it was missing for every song, not just obscure ones. The suspicion was API blocking (e.g. a missing `User-Agent`), but the user independently confirmed the actual root cause by checking lrclib's current docs: **the service moved to `lrclib.net`** — `lrclib.org` is the wrong host entirely. `lrclibClient.js` has been pointed at `lrclib.org` since it was written in `fetch-online-lyrics`, so every single request has been failing at the network level regardless of track, which is exactly the "missing for every song" symptom. Confirmed live: `lrclib.org` does not resolve at all, while `GET https://lrclib.net/api/get?artist_name=...&track_name=...` returns real data matching the shape our `parseLrc`/response-mapping code already expects (`id`, `trackName`, `artistName`, `albumName`, `duration`, `instrumental`, `plainLyrics`, `syncedLyrics`).

Compounding this, `requestLrclib`'s `catch` block collapses every failure mode — network error, non-200 HTTP status, no `syncedLyrics` field, timeout — into the same undifferentiated `null`, so a dead-domain failure looked identical to a genuine "not in their database" miss in the logs, which is why this took multiple rounds to actually localize.

## What Changes

- Fix `LRCLIB_ENDPOINT` in `lrclibClient.js`: `https://lrclib.org/api/get` → `https://lrclib.net/api/get`.
- Add a descriptive `User-Agent` header (app name + version, standard API-client etiquette, cheap to add and never harmful) to every request `lrclibClient.js` makes.
- Change `requestLrclib`'s internal failure handling to capture *why* a request produced no lyrics (HTTP status code, network error message, timeout, or "no synced lyrics in response") instead of collapsing everything to `null` — so a future domain/network-level failure like this one is immediately obvious from the logs instead of looking like a per-track miss.
- Thread that reason through `tracks.js`'s existing fallback-chain logging so the main-process log shows *why* the online lookup missed, not just that it missed.
- Include the failure reason in the payload returned to the renderer (only on a miss) so `player.js`'s console logging can print the actual cause in DevTools.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `online-lyrics-lookup` (from `fetch-online-lyrics`, in progress, not yet archived): corrected API host, requests now include a `User-Agent` header; lookup failures now carry a diagnostic reason instead of being silently indistinguishable `null`s.

## Impact

- **Backend**: `src/backend/utils/lrclibClient.js` (fix endpoint host, add header, restructure return value to include a reason on miss), `src/backend/main/tracks.js` (consume and log the reason, pass it through to the renderer payload on miss).
- **Frontend**: `src/frontend/store/player.js` (log the reason string when present).
- **No schema, no settings, no new dependencies.**
- This is expected to be the actual fix — every prior online-lookup miss reported this session is explained by the wrong host. The diagnostic-reason work remains valuable regardless, so a future failure of this kind is immediately visible instead of requiring another investigation.
