## ADDED Requirements

### Requirement: Screenshot showcase presentation
The landing page SHALL present each app screenshot in a framed card with a visible caption and SHALL display the full, uncropped image (no `object-fit: cover` cropping).

#### Scenario: Screenshot renders uncropped
- **WHEN** a visitor scrolls to the "App Screenshots" section
- **THEN** each screenshot is fully visible within its card (not cropped by the card boundary) and shows a caption describing what the screenshot depicts

#### Scenario: Screenshot click opens lightbox
- **WHEN** a visitor clicks a screenshot card's image
- **THEN** the existing lightbox overlay opens showing the full-size image, and can be closed via the close button, an outside click, or the Escape key

### Requirement: Last.fm sync feature card
The features grid SHALL include a card advertising Last.fm scrobbling support, consistent in structure (icon, heading, description) with the other feature cards.

#### Scenario: Last.fm card visible in features grid
- **WHEN** a visitor views the "Features" section
- **THEN** a feature card describing Last.fm sync/scrobbling (using user-supplied Last.fm API credentials) is present alongside the other feature cards

### Requirement: Consistent section visual language
Sections on the landing page (hero, features, CLI, screenshots) SHALL share a consistent heading style and card treatment so the page reads as one visual system.

#### Scenario: Section headings share styling
- **WHEN** a visitor compares the "Features" and "App Screenshots" section headings
- **THEN** both use the same heading style (size, weight, gradient treatment) established elsewhere on the page

#### Scenario: Cards reveal on scroll
- **WHEN** a visitor scrolls a feature card or screenshot card into view
- **THEN** the card transitions into view (e.g. fade/slide-in) rather than appearing abruptly, and the page remains fully usable if the visitor's browser does not support the reveal effect
