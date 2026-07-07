## Context

`docs/index.html` + `docs/index.css` + `docs/index.js` is a single static page (no build step, no framework) served via GitHub Pages. It already establishes a visual language: dark gradient background, glass-morphism cards (`rgba(255,255,255,0.05)` + blur + subtle border), a purple/blue gradient accent (`#667eea` → `#764ba2`), and a `.terminal-window`-style chrome for the CLI section. The screenshot section breaks that language — it's a bare `<img>` grid with `object-fit: cover`, which crops screenshots (often UI with edges/toolbars that matter) and gives no title/caption context. The feature grid also doesn't mention Last.fm scrobbling, which shipped in commit `724ce79` and is a real, working capability.

## Goals / Non-Goals

**Goals:**
- Screenshots are shown uncropped, framed in a card that echoes the site's existing visual language (glass card + gradient accent), each with a short caption.
- Existing lightbox click-to-zoom keeps working without a JS rewrite.
- Features grid gains a "Last.fm sync" card describing the shipped capability accurately (user-supplied API credentials, not a bundled default key).
- Hero/features/CLI sections get small consistency passes (heading treatment, spacing rhythm, a shared scroll-reveal entrance) so the page reads as one system rather than three stitched-together sections.

**Non-Goals:**
- No new screenshots are captured; existing files in `docs/assests/screenshots/` are reused as-is.
- No build tooling, bundler, or framework is introduced — stays plain HTML/CSS/JS.
- No changes to the Electron app itself, only the marketing page in `docs/`.

## Decisions

**Screenshot cards use `object-fit: contain` inside a fixed-aspect frame, not `cover`.**
Cropping via `cover` is the root cause of the "bad" look — toolbars/edges get cut unpredictably depending on each screenshot's native aspect ratio. `contain` inside a padded card with a solid backdrop keeps every screenshot fully visible regardless of its dimensions. Alternative considered: normalize all screenshots to one aspect ratio via image re-export — rejected as out of scope (would require regenerating assets, and the proposal explicitly reuses existing files).

**Reuse the existing `.terminal-header` dot-chrome pattern for screenshot card headers instead of inventing a new frame style.**
The CLI section already has a browser/terminal chrome (three colored dots) that visitors have seen once by the time they reach the screenshots section. Reusing it (new class, same visual idea) keeps the page's motif consistent instead of adding a fourth distinct card style. Alternative considered: a plain drop-shadow card with just a caption underneath — simpler, but does nothing to fix the "looks bad" complaint since it doesn't add framing.

**Captions are hard-coded per screenshot in HTML, not derived from filenames.**
There are only 7 screenshots; a small data-driven loop in JS would be over-engineering for a static count that rarely changes. Alternative considered: a JS array of `{src, alt, caption}` rendered at runtime — adds indirection for no real benefit at this scale, and makes the section harder to hand-edit later.

**Lightbox JS selector stays `.screenshot-gallery img`.**
The new markup keeps each `<img>` as a descendant of `.screenshot-gallery` (nested one level deeper inside a card wrapper), so `document.querySelectorAll(".screenshot-gallery img")` in `docs/index.js` continues to match every screenshot with zero JS changes to the existing click/ESC/outside-click handlers.

**Scroll-reveal is a single small `IntersectionObserver` in `index.js`, applied via a shared `.reveal` class, not a library.**
One `IntersectionObserver` toggling an `is-visible` class on `.feature-card` and the new `.screenshot-card` covers "improve consistency" without adding a dependency to a page that currently has zero npm dependencies (only a CDN `<script>` for Lucide icons).

**Last.fm feature card icon: Lucide `history` icon, not a Last.fm brand mark.**
Lucide (already loaded via CDN) has no Last.fm/brand icon, and pulling in a separate icon set for one glyph isn't worth it. `history` communicates "scrobbling / listening history sync" well enough alongside the card's text.

## Risks / Trade-offs

[Uncropped `contain` screenshots at varying native resolutions could look inconsistent in a strict grid] → Mitigation: fixed-height frame with centered `contain` image on a solid `#111`-ish backdrop (already used today) equalizes the visual footprint regardless of source aspect ratio.

[Hard-coded captions drift from screenshots if assets are swapped later] → Mitigation: acceptable at this scale (7 static images); not worth data-driven indirection now.

[IntersectionObserver unsupported in very old browsers] → Mitigation: feature-detect and no-op (cards simply render without the reveal animation, never permanently hidden) — matches this being a progressive-enhancement nicety, not core functionality.

## Migration Plan

Direct edit of static files, no deploy pipeline beyond GitHub Pages picking up the new commit on `docs/`. No data migration, no rollback complexity beyond `git revert`.

## Open Questions

None — scope is fully bounded by the existing static page and existing assets.
