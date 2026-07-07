## ADDED Requirements

### Requirement: Renderer Console Visibility for Lyrics Fetch
The system SHALL log the outcome of each lyrics fetch (source used, or that none was found) to the renderer DevTools console.

#### Scenario: Successful fetch logs its source
- **WHEN** a lyrics fetch resolves with lyrics from `.lrc`, embedded tags, or online lookup
- **THEN** the system SHALL log to the browser console which source provided the result

#### Scenario: No lyrics found logs that outcome
- **WHEN** a lyrics fetch resolves with no lyrics from any source
- **THEN** the system SHALL log to the browser console that no lyrics were found for the current track

### Requirement: Lyrics Panel Row-List Presentation
The Immersive Mode lyrics panel SHALL be presented as a row-based list (numbered rows, alternating row background, distinct highlight for the currently active line) consistent with the existing queue/playlist list styling elsewhere in the app, rather than centered floating text.

#### Scenario: Synced lyrics render as a row list
- **WHEN** the current track has synchronized lyrics
- **THEN** each lyric line SHALL render as a row consistent with the app's existing list-row styling, with the active row visually distinguished the same way the currently-playing queue row is distinguished

#### Scenario: Unsynced/plain lyrics still render as rows
- **WHEN** the current track has only unsynchronized lyrics
- **THEN** each line SHALL still render using the row-list styling (without an active-row highlight), rather than as a single centered text block
