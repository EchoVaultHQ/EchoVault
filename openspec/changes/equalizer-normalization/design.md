## Context

Playback lives entirely in `src/frontend/store/player.js`. A module-scope `AudioContext` and a single persistent `GainNode` (`gainNode`, master volume) are created once at import time and never recreated. Each track/seek creates a fresh `AudioBufferSourceNode` (source nodes are single-use) which connects directly to `gainNode` → `audioCtx.destination`. Tracks are read via IPC in chunks, concatenated, and fully decoded with `audioCtx.decodeAudioData()` into an in-memory `AudioBuffer` before playback starts — there is no streaming `<audio>`/`MediaElement` in the loop. The only existing gain control is `setVolume()`. The only precedent for a user preference persisted outside the DB is `localStorage.getItem("fetchLyricsOnline")`.

## Goals / Non-Goals

**Goals:**
- A 10-band graphic EQ (31Hz–16kHz) with 12 presets plus manual per-band override, applied live and audibly, surviving track changes.
- A "Normalize volume" toggle that measurably levels quiet vs. loud tracks.
- Settings persisted across app restarts.
- Reuse the existing Settings overlay, its toggle-switch CSS, and existing icons — no new UI framework/library.

**Non-Goals:**
- True EBU R128 / ITU-R BS.1770 LUFS metering — explicitly deferred; RMS-based approximation is the shipped ceiling.
- Per-track or per-playlist saved EQ — one global EQ setting for the whole app.
- Any new IPC channel or SQLite table — `localStorage` only.
- A floating/anchored popover UI system — the existing full-screen Settings overlay is reused instead.

## Decisions

**EQ and normalization nodes are created once at module scope in `player.js`, mirroring the existing `gainNode` pattern.**
The existing `gainNode` already proves this pattern works: create once, reuse across every track since `AudioNode`s (other than sources) are not single-use. Building a fresh filter chain per track would be wasted allocation and would need re-applying user gain values every play. Alternative considered: create the EQ chain per-`playTrack()` call — rejected, adds needless per-track setup and complicates persisting "live" tweaks mid-playback.

**Chain order is `source → normalizationGain → eq[0..9] → gainNode → destination`.**
Normalization must act on the raw decoded signal before tone-shaping so the loudness estimate and its compensating gain aren't skewed by EQ boosts/cuts; master volume (`gainNode`) stays last so it remains a pure, independent user-facing control untouched by either feature. Alternative considered: EQ before normalization — rejected, would make normalization's target loudness depend on whatever EQ curve happens to be active.

**Normalization uses stride-sampled RMS on channel 0, clamped to ±12dB, not full loudness metering.**
A proper LUFS meter (K-weighting filter + gating per ITU-R BS.1770) is a substantial DSP undertaking; RMS-based leveling gets most of the perceptual benefit (quiet tracks no longer buried, loud tracks no longer overwhelming) for a fraction of the code, and the buffer is already fully decoded in memory by the time this runs so no extra I/O is needed. Striding (every 100th sample) keeps the one-time per-track cost negligible even for long lossless tracks. Alternative considered: full BS.1770 implementation — rejected as disproportionate for a first version; noted as the explicit upgrade path if users report mismatched perceived loudness.

**EQ "bypass" (disabled) zeroes filter gains instead of disconnecting/reconnecting nodes.**
Rewiring the graph at runtime risks audible clicks/glitches and adds branching connect/disconnect logic. Setting all 10 filter gains to 0dB via `setTargetAtTime` is inaudible-transition-safe and the CPU cost of 10 no-op biquads is negligible. Alternative considered: disconnect the EQ chain and connect `normalizationGain` straight to `gainNode` when disabled — rejected, more state to track for no real benefit.

**Settings UI reuses the existing full-screen `Setting.vue` overlay; no new popover/positioning system.**
The two placeholders already living in `Setting.vue`'s Audio tab are the designated home for this feature. Building a separate anchored popover (a pattern that doesn't exist anywhere else in the codebase — `QueueSidebar` is a fixed slide-in panel, not an anchored popover) would introduce a new UI primitive for no functional gain. A new icon in the player bar simply jumps to that existing tab. Alternative considered: a popover anchored to a new player-bar button — rejected, adds positioning/z-index complexity the codebase has never needed before.

**Vertical sliders use native `<input type="range">` with `-webkit-appearance: slider-vertical`, not a slider library.**
EchoVault's renderer is always Chromium (Electron), so this non-standard-but-Chromium-native CSS property is reliable here even though it wouldn't be safe for a cross-browser web app. Zero new dependencies, zero custom drag-handling JS. Alternative considered: a custom div-based slider with pointer-event math — rejected, far more code for the same result on a fixed rendering target.

**Presets and band frequencies live in a plain data module (`eqPresets.js`), not a class or store.**
It's static, non-reactive lookup data — a plain exported object/array is the simplest representation and keeps the store focused on state/actions.

## Risks / Trade-offs

[RMS approximation may not match perceived loudness as well as true LUFS for some masters] → Mitigation: clamp to ±12dB prevents extreme over/under-correction; documented in code as a deliberate ceiling with an explicit upgrade path (swap in a BS.1770 meter later without changing the surrounding integration points).

[Sampling only channel 0 could slightly misjudge heavily panned stereo content] → Mitigation: acceptable given the approximation is already declared as such; cheap to extend to an average of both channels later if it matters in practice.

[`-webkit-appearance: slider-vertical` is non-standard CSS] → Mitigation: Electron's renderer is a fixed, known Chromium version — there is no cross-browser requirement for this app, so the risk is negligible.

[Zeroing EQ gains instead of disconnecting still runs 10 biquad filters even when "disabled"] → Mitigation: negligible CPU cost for a 10-node biquad chain on modern hardware; avoids reconnect-related timing glitches, which is the more valuable trade.

## Migration Plan

No data migration required. On first run after this change ships, no `localStorage` keys exist yet, so the read-at-module-init logic falls back to defaults (`eqEnabled: true` at the `Flat` preset, `normalizationEnabled: false`). Rollback is a plain code revert — no persisted schema is versioned or destructive.

## Open Questions

None blocking. Two explicit future-work candidates, not open blockers: per-track/per-playlist custom EQ memory, and upgrading normalization to true ITU-R BS.1770 LUFS metering.
