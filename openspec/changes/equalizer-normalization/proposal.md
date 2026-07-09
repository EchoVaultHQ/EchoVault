## Why

EchoVault plays every track through a single master `GainNode` with no tone-shaping or loudness-matching. Users have no way to boost bass/treble, apply a genre EQ preset, or level out volume differences between quiet and loud masters — capabilities Apple Music and Spotify both ship as standard. `Setting.vue`'s Audio tab already reserves two disabled "coming soon" placeholders for exactly this (`settings.audio.equalizer`, `settings.audio.normalization`), so the gap is pre-acknowledged.

## What Changes

- Add a persistent 10-band graphic equalizer (`BiquadFilterNode` chain, `31Hz`–`16kHz`) inserted into the playback signal path ahead of the existing master gain, with 12 genre/purpose presets (Flat, Bass Booster, Bass Reducer, Treble Booster, Treble Reducer, Vocal Booster, Rock, Pop, Jazz, Classical, Electronic, Acoustic) and manual per-band -12..+12dB override that switches the active preset to "Custom".
- Add a "Normalize volume" toggle that estimates each track's loudness (RMS-based approximation, not full LUFS) right after decode and applies a compensating pre-gain, clamped to ±12dB, so quiet and loud tracks play back closer in perceived volume.
- Replace the two disabled placeholders in Settings → Audio with live controls, and add a quick-access icon button in the player bar that jumps straight to that tab.
- Persist EQ/normalization settings to `localStorage` so they survive app restarts.

## Capabilities

### New Capabilities
- `equalizer-normalization`: 10-band graphic equalizer with presets and manual override, plus an RMS-approximate loudness normalization toggle, applied to the live playback audio graph and exposed via Settings + a player-bar shortcut.

### Modified Capabilities
(none — no existing spec covers audio playback processing)

## Impact

- Affected files: `src/frontend/store/player.js`, `src/frontend/utils/eqPresets.js` (new), `src/frontend/components/EqualizerPanel.vue` (new), `src/frontend/components/Setting.vue`, `src/frontend/components/PlayerBar.vue`, `src/frontend/App.vue`, `src/locales/en.json`, `src/locales/ja.json`.
- No backend/Electron main-process, IPC, or database changes — this is entirely a renderer-side WebAudio graph + Pinia store + Vue UI change.
