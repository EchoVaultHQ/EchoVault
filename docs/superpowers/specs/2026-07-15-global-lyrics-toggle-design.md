# Global Lyrics Panel Toggle

## Context

The lyrics side panel (`LyricsPanel.vue`, visibility driven by `player.showLyricsPanel`) can currently only be opened or closed from a toggle button duplicated in three page headers: `AllSongs.vue`, `Library.vue`, and `Playlists.vue`. If a user opens the panel then navigates to a page without that toggle (Home, Artists, Search, Media Management), they're stuck — the only way to close it is to navigate back to one of those three pages. The panel itself has no close control of its own.

`PlayerBar.vue` (the bottom transport bar) is mounted once at the `App.vue` root and persists across every route, making it the natural home for a single, global toggle. This closes the gap in both directions: the panel becomes reachable from anywhere, and also self-dismissing.

## Changes

### `src/frontend/components/PlayerBar.vue`
- Add a lyrics-toggle button to the existing `.track-utils` icon row (alongside mini-player, queue, cast, EQ, like).
- Reuse the existing `DesktopLyrics` SVG asset (`src/frontend/assets/icons/icons.js`) and its theme-aware `filter: invert()` CSS treatment — same icon used today, so the control keeps its established visual meaning rather than introducing a new glyph.
- Wire to `player.showLyricsPanel` / `player.toggleLyricsPanel()` (both already exist on the player store — no store changes needed).
- Active state styled consistently with the bar's other toggle-style buttons (mini-player, cast).

### `src/frontend/components/LyricsPanel.vue`
- Add a small close (X, Lucide `X`) button into the panel's own header area, calling `player.toggleLyricsPanel()`.
- Panel can now dismiss itself regardless of which page is open behind it.

### `src/frontend/components/AllSongs.vue`, `src/frontend/components/Library.vue`, `src/frontend/components/Playlists.vue`
- Remove the per-page lyrics-toggle button (markup + its scoped CSS) now that PlayerBar's toggle replaces it as the single control point. Leaves each header simpler (`AllSongs`/`Library` keep their sort controls / view toggles; `Playlists`' header keeps just the back button after last redesign).

### i18n
- No new keys needed — `labels.showLyrics` already exists and is reused for the new PlayerBar button's title/aria-label; the close button uses a generic `common.close` (check if it exists, add if missing to both locale files).

## Testing
- `PlayerBar.test.js` (if it exists — verify): add a case that clicking the lyrics button toggles `player.showLyricsPanel` and reflects the active state.
- `LyricsPanel.test.js` (if it exists — verify): add a case that clicking the close button calls `player.toggleLyricsPanel()`.
- Update/remove any existing `AllSongs.test.js`/`Library.test.js`/`Playlists.test.js` assertions tied to the removed per-page toggle button (search for `.toggle-btn` / `showLyricsPanel` in those specs first).

## Verification
- `npm run start`, play a track, open lyrics from the PlayerBar on Home, navigate to Artists/Search/Media Management — panel stays open and controllable throughout.
- Close it via the panel's own X button from a page that has no PlayerBar toggle duplicate (i.e., any page) — confirm it closes.
- Confirm the removed per-page toggles are gone from AllSongs/Library/Playlists without leaving orphaned CSS or unused imports (`DesktopLyrics` import moves to `PlayerBar.vue`, removed from the other three if no longer used there).
