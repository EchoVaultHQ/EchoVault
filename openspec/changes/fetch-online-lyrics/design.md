## Context

`sync-lyrics-display` built a two-step fallback chain in `tracks:get-lyrics` (in `src/backend/main/tracks.js`): `.lrc` sidecar file → embedded ID3 tags → empty result. In practice, step 1 requires the user to have manually sourced `.lrc` files, and step 2 requires the source file to carry rare SYLT/USLT tags — so most tracks hit the empty result and users never see the feature work. This change adds a third, automatic step that queries lrclib.org (a free, keyless, purpose-built synced-lyrics API already used by several open-source players) and persists a hit as a `.lrc` file, so it becomes a permanent local source exactly like a manually-downloaded one.

Settings persistence in this app is simple `localStorage` key/value (see `src/frontend/store/theme.js`, `src/frontend/store/accent.js`) — no settings table in SQLite. The new toggle follows that same pattern.

## Goals / Non-Goals

**Goals:**
- Automatically find synced lyrics for mainstream tracks with no user effort, the common case this feature needs to actually be useful.
- Persist a successful match to disk (`.lrc`) so the network is only hit once per track, ever (barring the file being deleted).
- Fail silently and fall through to "No lyrics found" on any network/lookup failure — never block or interrupt playback.
- Respect a user's choice to disable network lookups entirely (privacy/offline use).

**Non-Goals:**
- No lyrics-provider picker/multi-source merging — lrclib.org only for this pass.
- No manual "search for lyrics" UI (e.g. picking among multiple fuzzy matches) — accept lrclib.org's best match or nothing, matching how the embedded/`.lrc` sources already behave (silent success or silent miss).
- No retry/backoff queue for failed lookups — a session-level negative cache prevents re-querying the same track in the same run, but a fresh app launch will retry naturally (acceptable, matches how transient failures should resolve on their own).
- No bundling of a lyrics API key or paid-tier provider.

## Decisions

**1. New module `src/backend/utils/lrclibClient.js`, isolated from the fallback-chain logic in `tracks.js`.**
Single exported function `fetchLyricsFromLrclib({ artist, title, album, duration })` — a thin wrapper around `GET https://lrclib.org/api/get` (query params `artist_name`, `track_name`, `album_name`, `duration`), mapping the response's `syncedLyrics` (raw `.lrc`-format text) through the existing `parseLrc` (from `sync-lyrics-display`) so the output shape matches every other source. Returns `null` on no match, non-200, network error, or timeout — never throws to the caller. Alternative considered: inline the fetch directly in `tracks.js` — rejected, keeping the network client isolated makes it trivial to swap/mock in tests and matches the file's existing separation of concerns (`lrcParser.js` is already its own module).

**2. Query parameters sourced from existing track metadata, no new DB fields.**
`artist`/`title` come from the `tracks` table columns already loaded into `currentTrack` (`artist`, `title`); `duration` likewise already exists. `album` is passed if present, omitted if not (lrclib.org's API treats it as optional). No schema change needed — this was already true of the `sync-lyrics-display` design principle (lyrics are never persisted in SQLite).

**3. Successful match writes a `.lrc` file next to the source audio file, using the exact sibling-path convention from `sync-lyrics-display`'s `.lrc` lookup (same basename, swapped extension).**
This makes the online-sourced result indistinguishable from a manually-placed file on the next play — the existing `.lrc`-first check in the fallback chain picks it up directly, no special-casing needed for "was this from lrclib.org." Write failure (read-only filesystem, permissions) is caught and logged, but the fetched lyrics are still returned for the current session even if the write fails — a failed write shouldn't make the current playback miss out on lyrics it already fetched.

**4. Session-level negative-result cache is an in-memory `Map` keyed by `file_path`, module-scoped in `tracks.js` (or a small new module), cleared on app restart.**
Prevents hammering lrclib.org every time a track loops or replays in the same session. Not persisted to disk — a track that gets a real lyrics match uploaded to lrclib.org later should be retried on the next app launch, not permanently blacklisted.

**5. Settings toggle: `localStorage.getItem("fetchLyricsOnline")`, default `"true"` if unset, following the exact pattern `theme`/`accent` already use.**
Read at the point `tracks:get-lyrics` decides whether to attempt the online step — no new store module required, a simple `localStorage` check in the handler mirrors how lightweight the theme toggle already is. UI: single toggle row added to `Setting.vue`'s existing settings-panel structure.

**6. Network fetch uses a short timeout (e.g. `AbortController` with ~5s) so a slow/unreachable API never noticeably delays lyrics appearing (or the "no lyrics" placeholder) beyond an acceptable wait.**
Playback itself is never blocked (lyrics fetch is already fire-and-forget from `setTrack()` per `sync-lyrics-display`'s design) — this timeout only bounds how long the Immersive Mode lyrics panel might show a loading/empty state before falling back.

## Risks / Trade-offs

- **Third-party dependency**: lrclib.org could be slow, rate-limit, or go offline. Mitigation: silent failure + short timeout means the app degrades to exactly today's behavior ("No lyrics found"), never worse.
- **Privacy**: track artist/title/duration leave the device for every unmatched track (until cached). Mitigation: default-on but user-visible, one-click opt-out in Settings; no other track/listening data is sent (no full library scan/upload).
- **False-positive matches** (wrong lyrics for a similarly-named track): out of scope to solve algorithmically here — lrclib.org's own matching (artist+title+duration) is reasonably strict; no UI is added to let users reject/report a bad match in this pass.
- **Disk write failures** (read-only music folders, permissions) silently degrade to "works this session, refetches next time" rather than erroring — acceptable per Goals (never block/interrupt the user).
