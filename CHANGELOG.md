# EchoVault

## Commits

- CORE : Backend changes
- UI : Frontend changes
- BUG : Any CORE/UI bug fix
- IMP : Enhancement of current feature
- FEAT : New feature
- DOCS : Documentation updates (README, comments)
- CHORE : Build config, dependencies, tooling
- REFACTOR : Code restructuring

---

## Pending Tasks

- Add full-screen lyrics view (linked to player)

---

## Known Bugs

- Player silently fails to play song ( work around is to CTRL + R refresh the app and play again)
- Tracks with the same filename in different folders overwrite cover
- FLAC duration sometimes returns `NaN`
- Watcher re-triggers too often on folder changes
- Metadata extraction fails for some cases
- Music playback fails for some songs , this causes glitch in the playerbar and queue indexes
- Music playback stops and wont reset until app restart when queue play ends

---

## Future Enhancements

- User feedback (recently added, most played .. summary)
- Lyrics sync support (timestamped `.lrc` parsing)
- Theming system (custom gradients, user-defined accent)

---

## Recent Fixes

- Added: 10-band graphic equalizer with presets (Flat, Bass/Treble Booster & Reducer, Vocal Booster, Rock, Pop, Jazz, Classical, Electronic, Acoustic) plus manual per-band override, in Settings > Audio
- Added: loudness normalization toggle ("Normalize volume"), live-adaptive RMS-based gain applied per track
- Added: quick-access equalizer icon in the player bar, jumps straight to Settings > Audio
- Added: output device selection (Settings > Devices) via the Audio Output Devices API, persisted across restarts
- Upgrade: audio engine now streams playback through a custom `echovault-audio://` protocol with real byte-range/seek support, instead of reading and decoding whole files into memory before playback
- Upgrade: volume slider now uses a perceptual (cubic) taper instead of linear gain, so the whole slider range feels even
- Upgrade: `AudioContext` no longer forces 48kHz — matches the output device's native sample rate instead of always resampling
- Fixed: volume slider was out of sync between normal, immersive, and mini player views
- Fixed: volume bar fill animation not updating when switching between normal/immersive/mini player views
- Fixed: seeking while paused would resume playback unexpectedly
- Fixed: normalization loudness measurement only sampled one audio channel, now averages across all channels
- Fixed: better-sqlite3 build issue with Electron Forge (`ignore` regex trick) (dfad6e6)
- Fixed: duplicate artist rows when rescanning folders (1590622)
- Fixed: deleting folders wont cascade delete artists (536d2d3)
- Fixed: cover image for same artist spreads for all related tracks
- Fixed: built app doesnt load home page on launch or takes too much time
- Fixed: RAM leak in app player
- Fixed: added a fallback mechanism for audio decode error

---

_Last updated: 2026-07-09_
