## Context

`lrclibClient.js` (from `fetch-online-lyrics`) has `LRCLIB_ENDPOINT = "https://lrclib.org/api/get"`. This host does not resolve at all (confirmed: `lrclib.org` fails DNS resolution; the real service is at `lrclib.net`, confirmed live and matching the app's expected response shape — `id`, `trackName`, `artistName`, `albumName`, `duration`, `instrumental`, `plainLyrics`, `syncedLyrics`). Every online lookup made since `fetch-online-lyrics` was implemented has therefore failed at the network level, regardless of track — exactly matching "missing for every song," including a track as ubiquitous as "Believer."

The existing `catch (err) { return null }` in `requestLrclib` meant this network-level failure was indistinguishable from a genuine "not found" in the logs, which is why localizing this took multiple rounds. Fixing the domain is the actual bug fix; the diagnostic-reason work (planned before the domain was identified) remains valuable so a failure like this is immediately visible next time instead of requiring another investigation.

## Goals / Non-Goals

**Goals:**
- Point `lrclibClient.js` at the correct host, `lrclib.net`.
- Send a proper `User-Agent` header on every request, standard API-client etiquette.
- Make lookup failures diagnosable end-to-end: capture *why* a request produced nothing, surface it in both the main-process log and the renderer DevTools console.

**Non-Goals:**
- No change to the fallback order, album-retry logic, persistence, or negative-cache behavior from prior changes — only the request headers and failure-reason plumbing change.
- No UI surfacing of the failure reason to the end user (still just "No lyrics found" in the panel) — the reason is a developer-facing log only, per the original ask.

## Decisions

**1. Fix the endpoint constant directly (`lrclib.org` → `lrclib.net`), no fallback/dual-host logic.**
The old host simply doesn't exist for this API — there's no scenario where trying both hosts makes sense (unlike the album-name retry, which handles a genuine ambiguity in matching). A straight one-line fix, verified against the corrected docs and a live test request matching the user-supplied example.

**2. `User-Agent` string built from `package.json`'s existing `name`/`version` fields, not hardcoded separately.**
`{name: "echovault", version: "1.0.1-beta"}` already exist in `package.json` — reusing them (`EchoVault/1.0.1-beta (+https://github.com/ACS-lessgo/EchoVault)`) keeps the header accurate as the app version bumps, without introducing a second source of truth for the version string.

**3. `requestLrclib` returns `{ lyrics, reason }` instead of a bare value.**
`reason` is one of: `"ok"`, `"http-404"` (or other status codes), `"no-synced-lyrics"` (200 response but no `syncedLyrics` field — e.g. only plain lyrics exist), `"network-error: <message>"`, `"timeout"`. `fetchLyricsFromLrclib` (the album-retry wrapper) returns the first hit's `{ lyrics, reason: "ok" }`, or the *second* (album-less) attempt's reason if both miss — since that's the more informative attempt (no album-mismatch confound). Alternative considered: throw distinguishable error types instead of a reason string — rejected, this call site already treats failure as a normal (non-exceptional) outcome per `sync-lyrics-display`'s "never throw" convention; a string reason fits that pattern without introducing exception-based control flow.

**4. The reason is only included in the payload back to the renderer when there are no lyrics.**
On a hit, `source: "online"` already tells the renderer everything relevant. Only the miss case needs the extra diagnostic — keeps the success-path payload shape unchanged from `fetch-online-lyrics`.

## Risks / Trade-offs

- **lrclib.net could itself move/rename again** — the diagnostic-reason logging means a future repeat of this exact failure mode (wrong/dead host) is immediately visible in logs as a network error, not silently indistinguishable from "no lyrics for this track."
- **Reason strings in logs could include raw error messages** (e.g. `ENOTFOUND`) — acceptable, these are developer-facing logs (main process log file + DevTools console), not user-facing UI text.
