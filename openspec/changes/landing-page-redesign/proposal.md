## Why

The `docs/` landing page's screenshot section is a flat, uncaptioned image grid using `object-fit: cover`, which crops app UI unpredictably and gives screenshots no context or visual polish compared to the rest of the page (glass-morphism feature cards, gradient accents, animated hero). The page also ships without any mention of the recently added Last.fm scrobbling support, so a real, working feature is invisible to visitors evaluating the app.

## What Changes

- Redesign the screenshots section: replace the raw cropped image grid with framed, captioned showcase cards (browser/app-window chrome, title + short description per screenshot) laid out in a responsive gallery, preserving the existing lightbox click-to-zoom behavior.
- Add a new feature card to the features grid: "Last.fm sync" describing user-supplied API credential scrobbling support.
- Improve visual consistency of the hero, features, and CLI sections: unify section spacing/heading treatment, add a lightweight scroll-reveal entrance for cards, and tidy the section dividers so the page reads as one coherent flow.
- No functional/app behavior changes — this is a static marketing page (`docs/index.html`, `docs/index.css`, `docs/index.js`) update only.

## Capabilities

### New Capabilities
- `docs-landing-page`: Structure, styling, and content rules for the public GitHub Pages landing page (`docs/`), covering hero, features grid, CLI showcase, and screenshot gallery sections.

### Modified Capabilities
(none — no existing spec covers the landing page today)

## Impact

- Affected files: `docs/index.html`, `docs/index.css`, `docs/index.js`.
- Affected assets: existing files in `docs/assests/screenshots/` (reused, not replaced).
- No backend/Electron app code touched; no build step involved (plain static HTML/CSS/JS served via GitHub Pages).
