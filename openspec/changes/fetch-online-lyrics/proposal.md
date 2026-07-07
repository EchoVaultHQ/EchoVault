## Why

The `sync-lyrics-display` change (in progress, 12/17 tasks done) made synced lyrics work when a `.lrc` sidecar file or embedded SYLT/USLT tag exists — but almost no user's library actually has either without manual effort (downloading `.lrc` files by hand per track). That's a dead-on-arrival flow for most users: they'll open Immersive Mode, see "No lyrics found" on nearly every track, and never discover the feature works at all. Adding an automatic online lookup (lrclib.org — free, keyless, purpose-built for synced lyrics) as a third fallback source makes synced lyrics actually appear out of the box for the majority of mainstream tracks, with zero setup.

## What Changes

- Add a third lyrics source, queried only when both `.lrc` and embedded tags come up empty: lrclib.org's public API (`GET /api/get` by artist/title/album/duration).
- On a successful online match, write the returned synced lyrics to a `.lrc` file next to the track (same convention `sync-lyrics-display` already established for local files) so subsequent plays are instant and offline, and the file is portable to any other player.
- Add a Settings toggle ("Fetch lyrics online") to opt out of network lookups entirely, default **on**.
- Handle lookup failure gracefully (no match, offline, API error) by falling through to the existing "No lyrics found" placeholder — never blocking playback or erroring visibly to the user.
- Cache negative results in-memory per app session (don't re-query lrclib.org for a track that already returned no match this session) to avoid redundant network calls when a track replays.

## Capabilities

### New Capabilities
- `online-lyrics-lookup`: Querying lrclib.org for synced lyrics when local sources are exhausted, persisting successful matches as `.lrc` files, and a user-facing setting to disable the network lookup.

### Modified Capabilities
- `synced-lyrics` (from the in-progress `sync-lyrics-display` change — not yet archived, so no formal spec file exists yet to diff against; treat this as extending that change's fallback chain with a third step once both changes are implemented): the lyrics resolution order becomes `.lrc` file → embedded tags → **online lookup (new)** → none found.

## Impact

- **Backend**: new `src/backend/utils/lrclibClient.js` (HTTP fetch + response mapping to the app's existing lyrics shape), `src/backend/main/tracks.js` (extend the fallback chain from `sync-lyrics-display`, add `.lrc`-file write-back on successful online match).
- **Settings**: new toggle in `Setting.vue` + a persisted preference (reuse whatever mechanism `theme`/`accent` settings already use for persistence, per the existing `fix-theme-persistence` change).
- **Network**: first outbound network dependency for the lyrics feature — must fail closed (silently) on offline/timeout, never surfaced as an error to the user beyond the existing "No lyrics found" state.
- **No DB schema changes** — session-level negative-result cache is in-memory only, matches lyrics are persisted as `.lrc` files on disk, not in SQLite.
- **Depends on** `sync-lyrics-display` being implemented first (this change extends its handler and fallback chain; it is not a standalone rewrite).
