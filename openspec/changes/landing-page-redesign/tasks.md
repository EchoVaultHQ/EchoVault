## 1. Screenshots section markup

- [x] 1.1 In `docs/index.html`, replace the flat `<img>` list inside `.screenshot-gallery` with one `.screenshot-card` wrapper per screenshot, each containing a dot-chrome header (reusing the `.terminal-header`/`.dot` pattern), the `<img>`, and a `<figcaption>`/`<p>` caption for the 7 existing screenshots (home, all-songs, colors-n-themes, queue, artists, library-view, playlists).
- [x] 1.2 Confirm each `<img>` remains a descendant of `.screenshot-gallery` so the existing `docs/index.js` lightbox selector (`.screenshot-gallery img`) still matches all 7 images without JS changes.

## 2. Screenshots section styling

- [x] 2.1 In `docs/index.css`, add `.screenshot-card` styles (glass-card background/border matching `.feature-card`, fixed-height image frame, `object-fit: contain` instead of `cover`, dot-chrome header spacing, caption typography).
- [x] 2.2 Update `.screenshot-gallery` grid/gap rules as needed for the new card layout; remove the now-unused direct `img` cropping/hover rules under `.screenshot-gallery img` (or scope them to `.screenshot-card img`).
- [x] 2.3 Verify responsive behavior at the existing `@media (max-width: 968px)` breakpoint (cards stack cleanly, captions remain readable).

## 3. Last.fm feature card

- [x] 3.1 In `docs/index.html`, add a new `.feature-card` to `.features-grid` with a Lucide `history` icon, heading "Last.fm sync", and a short description mentioning scrobbling via user-supplied Last.fm API credentials.

## 4. Cross-section visual consistency

- [x] 4.1 In `docs/index.html`, apply the `.section-title` class (or an equivalent shared heading treatment) to the "Features" and "CLI" section headings so they visually match the "App Screenshots" heading.
- [x] 4.2 In `docs/index.css`, review and align spacing (`margin`/`padding`) rhythm between `.features`, `.cli-section`, and `.screenshots` so section-to-section spacing feels consistent.
- [x] 4.3 Add a `.reveal` / `.is-visible` CSS transition (opacity + translateY fade-in) for `.feature-card` and `.screenshot-card`.
- [x] 4.4 In `docs/index.js`, add a small `IntersectionObserver` that adds `.is-visible` to `.reveal` elements as they scroll into view, with a feature-detect guard so the page still renders normally (all cards visible) if `IntersectionObserver` is unavailable.

## 5. Verification

- [x] 5.1 Open `docs/index.html` directly in a browser (or via a static file server) and manually verify: screenshots render uncropped with captions, lightbox still opens/closes (click image, click outside, Escape key), the Last.fm card appears in the features grid, and cards fade in on scroll.
- [x] 5.2 Resize the browser to a narrow (mobile) width and confirm the screenshot cards and feature grid reflow without overflow or clipping.

## 6. Small-phone overflow fix

- [x] 6.1 In `docs/index.css`, `.screenshot-gallery` (`minmax(300px, 1fr)`) and `.features-grid` (`minmax(280px, 1fr)`) both overflow viewports narrower than their floor + `0 3rem` side padding (e.g. iPhone SE at 375px), forcing horizontal scroll. Added a `@media (max-width: 480px)` rule setting both grids to `grid-template-columns: 1fr` and reducing `.screenshots`/`.features` side padding to `1.25rem`.
- [x] 6.2 Re-check at 375px and 320px widths that the page has no horizontal scrollbar and both screenshot and feature cards fill the available width.
