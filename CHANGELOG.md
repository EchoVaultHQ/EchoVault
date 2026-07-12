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

- Upgrade: Immersive Mode redesigned to match the reference mockup — new header (collapse, quick equalizer shortcut, exit), like button moved under the track title, queue/more-options controls added to the bottom bar, shuffle and repeat now flank previous/play/next, and the background now bleeds the album art toward the right edge instead of a fully blurred+vignetted fill (9a6d7aa)
- Added: Esc key exits Immersive Mode (9a6d7aa)
- Upgrade: Player bar redesigned into a floating rounded pill with an integrated progress bar, crisper icon set, and shuffle/repeat grouped together with previous/play/next (c8691d8)
- Upgrade: Play Queue panel redesigned — album art thumbnail per row, flat list (removed zebra striping), subtler accent-tinted "now playing" highlight matching the library view, and a proper empty-queue state (630ca8e)
- Upgrade: song list's "..." menu redesigned with icons and rebuilt around a declarative item list, so adding a future menu action no longer requires new markup (4598498)
- Added: Like/Unlike a song directly from the song list "..." menu, without it needing to be the currently playing track (4598498)
- Fixed: liked-song heart and active-shuffle icons rendered as an unreadable dark blob instead of highlighting — a CSS specificity bug was dropping their icon-tint filter (9a6d7aa)
- Fixed: the "..." dropdown menu in Immersive Mode was clipped to a sliver by the player bar's rounded corners (9a6d7aa)
- Fixed: saved accent color only applied after opening Settings > Appearance — now applied on launch, so the Play Queue highlight and other accent-colored UI show your chosen color immediately instead of the default purple (9a6d7aa)
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

_Last updated: 2026-07-12_
