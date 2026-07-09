## 1. Preset data

- [ ] 1.1 Create `src/frontend/utils/eqPresets.js` with `EQ_BANDS` (10 frequencies) and `EQ_PRESETS` (12 presets × 10 dB values each) and `PRESET_NAMES`.

## 2. Audio graph + store logic

- [ ] 2.1 In `src/frontend/store/player.js`, add `normalizationGain` + 10 `BiquadFilterNode`s at module scope, wire `source → normalizationGain → eq[0..9] → gainNode → destination`, and change the two `.connect(gainNode)` call sites (`playTrack()`, `seekTo()`) to `.connect(normalizationGain)`.
- [ ] 2.2 Add `eqEnabled`, `eqPreset`, `eqBands`, `normalizationEnabled` state, read once from `localStorage` at module init with try/catch + array-shape validation (fallback to Flat/disabled on corrupt data).
- [ ] 2.3 Add `setEQBand(index, gainDb)` and `applyEQPreset(name)` actions (clamp, update state, apply live gains, persist, set `eqPreset` to `"Custom"` on manual band edit).
- [ ] 2.4 Add `setEQEnabled(enabled)` action (bypass via zeroed gains, restore on re-enable, persist).
- [ ] 2.5 Add `computeNormalizationGainDb(buffer)` helper (stride-sampled RMS, clamp ±12dB, silent-buffer guard) and `setNormalizationEnabled(enabled)` + internal apply-for-current-buffer action.
- [ ] 2.6 Call the normalization apply step inside `playTrack()` right after `decodeAudioData()`, before `source.start(0)`, so it recomputes fresh per track.

## 3. Equalizer panel UI

- [ ] 3.1 Create `src/frontend/components/EqualizerPanel.vue`: preset `<select>` + 10 vertical band sliders (native `<input type="range">`, `-webkit-appearance: slider-vertical`), dB/frequency labels, props `bands`/`preset`/`enabled`, emits `update-band`/`update-preset`.
- [ ] 3.2 Style to fit within `Setting.vue`'s 900px-max-width `.settings-main` column, dimmed/disabled appearance when `enabled` is false.

## 4. Settings integration

- [ ] 4.1 Replace the two disabled placeholders in `Setting.vue` (Audio tab) with a live Equalizer group (enable toggle + `EqualizerPanel`) and a live Normalization group (toggle), wired to the player store.
- [ ] 4.2 Add an `initialTab` prop to `Setting.vue` and a `watch(showSettingMenu)` that resets `activeTab` to it whenever the overlay opens.

## 5. Quick access

- [ ] 5.1 Add an equalizer icon button to `PlayerBar.vue`'s `.track-utils` (reusing the existing `Settings` icon), emitting `open-equalizer`.
- [ ] 5.2 Wire `open-equalizer` in `App.vue`: set `settingsInitialTab = "audio"` and open Settings.

## 6. i18n

- [ ] 6.1 Add `settings.audio.equalizer.{enable,preset,presets.*}` and `settings.audio.normalization.enable` to `src/locales/en.json`.
- [ ] 6.2 Same additions to `src/locales/ja.json`.
- [ ] 6.3 Add `labels.equalizer` to both locale files for the PlayerBar button title.

## 7. Verification

- [ ] 7.1 Run the app; toggle EQ on/off (audible tone change); switch presets (sliders + sound update together); drag a slider (preset switches to "Custom").
- [ ] 7.2 Toggle Normalization; play a quiet track then a loud one; confirm perceived loudness levels out with no clipping.
- [ ] 7.3 Click the new player-bar equalizer icon; confirm Settings opens directly on the Audio tab.
- [ ] 7.4 Restart the app; confirm EQ bands/preset and normalization toggle persisted.
- [ ] 7.5 Corrupt `localStorage["eqBands"]` via devtools, restart; confirm fallback to Flat without crashing.
- [ ] 7.6 Switch tracks rapidly with normalization on; confirm gain recomputes per track with no stale carryover.
