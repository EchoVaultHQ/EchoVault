## Context

`src/main.js` creates the main window with `frame: false` (custom titlebar). `win:set-immersive-mode` (in `window.js`) calls `setFullScreen(true)` then `setResizable(false)`; `win:reset-immersive-mode` reverses both. This pairing predates the lyrics work but was masked by the `setResizeable` typo (the resizable call always threw before doing anything). Fixing the typo made the call actually execute, surfacing a Linux window-manager interaction bug: toggling resizability immediately around a fullscreen transition on a frameless window causes the WM to lose track of window geometry, pinning it to the top-left corner and freezing input.

`QueueSidebar.vue`'s `.queue-item`/`.queue-list` pattern is the app's established convention for "list of things related to the current track": numbered rows, alternating background (`nth-child(odd/even)`), hover highlight, and a distinct highlight for the currently-relevant row (`.playing`). The current lyrics panel in `ImmersiveMode.vue` uses a centered, floating-text treatment that doesn't match this convention.

## Goals / Non-Goals

**Goals:**
- Stop the Immersive Mode freeze without losing the "can't resize while in fullscreen" property (which fullscreen already provides natively).
- Make lyrics fetch outcomes visible in the renderer DevTools console, where the user is already looking.
- Reskin the lyrics panel to the app's existing row-list visual language, reusing the same structural pattern as `QueueSidebar.vue`.

**Non-Goals:**
- No change to the lyrics fallback chain, resolution order, or backend logging added in the prior change (that logging stays, this only adds a renderer-side echo).
- No change to auto-scroll/active-line-detection logic (`activeLyricIndex`) — only its visual presentation changes.
- No new settings or configuration for the window-fullscreen behavior.

## Decisions

**1. Drop `setResizable` entirely from the immersive-mode handlers rather than reordering or guarding it.**
`setFullScreen(true)` already prevents the user from manually resizing the window on every supported platform — the explicit `setResizable(false)` was redundant defense-in-depth that happens to actively break Linux. Alternative considered: call `setResizable(false)` *before* `setFullScreen(true)` instead of after — rejected as still an unnecessary interaction with the WM for no behavioral gain; simplest fix is deleting the redundant calls, not reordering a call that isn't needed.

**2. Renderer logging is `console.log`, not routed through `window.api.info` (which forwards to `electron-log`).**
The user is looking at the renderer DevTools console specifically ("i have no way of verifying... in console"). `window.api.info` already exists for main-process-visible logs (used in the prior change); adding plain `console.log` in `player.js` is the direct, zero-indirection way to get output into the same console the user has open. No new logging abstraction introduced.

**3. Lyrics panel restructured to mirror `.queue-item`'s markup/CSS shape, not extracted into a shared component.**
Both `QueueSidebar.vue` and `ImmersiveMode.vue` are Vue SFCs with scoped styles; copying the established row/index/highlight visual pattern (not the queue-specific logic — no remove buttons, no drag-resize, no click-to-play) keeps the two lists visually consistent without introducing a shared component for a two-usage pattern this early. Revisit extraction if a third list adopts the same look.

## Risks / Trade-offs

- **Removing `setResizable` calls**: on some platforms a user could theoretically resize out of fullscreen mid-transition — negligible risk, `setFullScreen` itself already blocks native resize handles/edges on all three desktop platforms Electron targets.
- **Console logging verbosity**: adds a few `console.log` lines per track change — acceptable, matches the debugging need directly requested; not left in a state that spams unrelated flows.
