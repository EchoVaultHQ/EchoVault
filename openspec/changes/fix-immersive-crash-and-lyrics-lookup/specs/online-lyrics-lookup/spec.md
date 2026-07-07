## ADDED Requirements

### Requirement: Album-less Retry on Online Lookup Miss
When an online lyrics lookup (with `album_name` included) returns no match, the system SHALL retry the same lookup once without `album_name` before treating the track as having no online match.

#### Scenario: Album-qualified lookup misses, unqualified retry hits
- **WHEN** an online lookup including `album_name` returns no match, but the same artist/title/duration without `album_name` would match
- **THEN** the system SHALL retry without `album_name` and return the matched synced lyrics from that retry

#### Scenario: Both attempts miss
- **WHEN** neither the album-qualified nor the album-less lookup returns a match
- **THEN** the system SHALL treat the track as having no online match (session-negative-cached, falls through to "no lyrics found") exactly as before this change

### Requirement: Lyrics Fallback Chain Diagnostic Logging
The system SHALL log which lyrics source was attempted (`.lrc` file, embedded tags, online lookup) and its outcome (hit/miss/error) for each `tracks:get-lyrics` request, using the existing logging mechanism already used elsewhere in the backend.

#### Scenario: Each fallback step logs its outcome
- **WHEN** a lyrics request falls through `.lrc` (miss) → embedded tags (miss) → online lookup (hit or miss)
- **THEN** the system SHALL log the outcome of each attempted step, sufficient to determine from logs alone which source (if any) ultimately provided lyrics
