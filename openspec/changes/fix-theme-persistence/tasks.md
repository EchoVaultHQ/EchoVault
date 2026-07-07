## 1. Fix shutdown sequence

- [x] 1.1 Remove `app.exit(0)` call from `window-all-closed` handler in `src/main.js` (keep `app.quit()`)
- [x] 1.2 Change `before-quit` handler in `src/main.js` to stop calling `win.destroy()` on all windows; let default quit sequence close them

## 2. Verify

- [x] 2.1 Run app, switch theme in Settings, fully quit (not just close to tray if applicable), relaunch, confirm theme retained
- [x] 2.2 Confirm app still exits cleanly on window-all-closed (no hang, no zombie process) on Linux/Windows
- [x] 2.3 Confirm existing behavior unaffected: no saved theme still falls back to system preference / dark default on first run

## 3. Fix duplicated accent-color implementation (real root cause of reported bug)

Discovered during verification: `TopBar.vue` and `Setting.vue` each kept an independent
`activeAccent` ref, own `accentColors` list, and own `setAccent()` writing the same
`localStorage` key, with mismatched hardcoded fallback colors (`#3498db` vs `#8e44ad`).
Neither applied the saved accent before first paint, so the CSS-default accent
(`#8e44ad`, purple) showed until `TopBar.vue`'s `onMounted` ran (or not at all
if it hadn't yet / accent was never actually saved to disk).

- [x] 3.1 Create `src/frontend/store/accent.js` (Pinia store, same pattern as `theme.js`) as single source of truth for `accentColor`
- [x] 3.2 Apply saved accent color pre-mount in `src/renderer.js` (mirrors existing theme flash-prevention)
- [x] 3.3 Update `Setting.vue` to use `useAccentStore` instead of its own local `activeAccent`/`accentColors`/`setAccent`
- [x] 3.4 Remove duplicate accent logic from `TopBar.vue` (dead `accentColors`/`activeAccent`, redundant `setAccent`, `onMounted` re-apply)
- [x] 3.5 Manually verify: pick a non-default accent color, fully quit, relaunch — correct color shown immediately (no purple flash) and correct swatch highlighted in Settings
