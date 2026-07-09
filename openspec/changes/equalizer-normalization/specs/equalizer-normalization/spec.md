## ADDED Requirements

### Requirement: 10-band graphic equalizer
The player SHALL apply a persistent 10-band graphic equalizer (31Hz–16kHz peaking filters, -12..+12dB per band) to the live playback signal, offering 12 named presets and manual per-band override.

#### Scenario: Preset changes audible tone
- **WHEN** a user selects an EQ preset (e.g. "Bass Booster") in Settings → Audio
- **THEN** all 10 band sliders update to that preset's values and the currently playing track's tone audibly changes to match

#### Scenario: Manual band edit switches to Custom
- **WHEN** a user drags any single band slider away from the active preset's value
- **THEN** the active preset label changes to "Custom" and only that band's gain changes, all others staying at their prior values

#### Scenario: Disabling EQ bypasses tone-shaping
- **WHEN** a user turns the equalizer's enable toggle off
- **THEN** all bands audibly flatten to no tone-shaping (equivalent to Flat) while the underlying custom/preset values remain stored and are restored when re-enabled

### Requirement: Loudness normalization
The player SHALL offer a "Normalize volume" toggle that estimates each track's loudness after decode and applies a compensating gain, clamped to ±12dB, so perceived volume is more consistent across tracks.

#### Scenario: Quiet and loud tracks level out
- **WHEN** normalization is enabled and the user plays a quiet track followed by a loud track
- **THEN** both tracks play back at a closer perceived volume than with normalization off, without audible clipping

#### Scenario: Recomputes per track
- **WHEN** normalization is enabled and the user switches from one track to another
- **THEN** the compensating gain is recalculated for the newly loaded track's buffer and never carries over the previous track's gain value

#### Scenario: Silent or near-silent buffer does not over-boost
- **WHEN** normalization is enabled and the currently loaded track is silent or near-silent
- **THEN** no excessive gain boost is applied (gain adjustment is clamped and defaults to no change for a zero/degenerate loudness measurement)

### Requirement: Settings persistence across restart
Equalizer and normalization settings (enabled state, active preset, per-band gains) SHALL persist across application restarts.

#### Scenario: Settings survive restart
- **WHEN** a user customizes EQ bands and enables normalization, then restarts the app
- **THEN** the same EQ preset/bands and normalization toggle state are restored on next launch

#### Scenario: Corrupt persisted data falls back safely
- **WHEN** the persisted EQ band data is missing, malformed, or the wrong shape
- **THEN** the app falls back to the Flat preset and default normalization state instead of crashing or applying invalid gains

### Requirement: Settings UI access
Equalizer and normalization controls SHALL be reachable from the Settings Audio tab, and a player-bar shortcut SHALL jump directly to that tab.

#### Scenario: Player bar shortcut opens Audio tab directly
- **WHEN** a user clicks the equalizer icon in the player bar
- **THEN** the Settings overlay opens with the Audio tab already active, showing the equalizer and normalization controls
