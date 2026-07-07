## ADDED Requirements

### Requirement: Lyrics Source Resolution
The system SHALL resolve lyrics for the currently playing track by checking, in order: (1) a `.lrc` sidecar file with the same basename as the audio file in the same directory, (2) embedded ID3/Vorbis/APE lyrics tags via the existing `extractEmbeddedLyrics` utility. If neither source yields lyrics, the system SHALL report no lyrics found rather than throwing an error.

#### Scenario: Track has a matching .lrc file
- **WHEN** a track at `/music/Song.mp3` is loaded and `/music/Song.lrc` exists with valid `[mm:ss.xx]` timestamped lines
- **THEN** the system SHALL return synchronized lyrics parsed from the `.lrc` file, with `source: "lrc"` and `synchronized: true`

#### Scenario: No .lrc file, but embedded SYLT tag exists
- **WHEN** a track has no sibling `.lrc` file, and its ID3 tags contain a valid SYLT (synchronized lyrics) frame
- **THEN** the system SHALL return synchronized lyrics extracted from the embedded tag, with `source: "embedded"` and `synchronized: true`

#### Scenario: No .lrc file, only embedded unsynced lyrics (USLT/TXXX)
- **WHEN** a track has no sibling `.lrc` file, and its tags contain only unsynchronized lyrics text
- **THEN** the system SHALL return plain text lyrics with `source: "embedded"` and `synchronized: false`, and no timestamps array

#### Scenario: No lyrics found anywhere
- **WHEN** a track has no `.lrc` file and no lyrics tags of any kind
- **THEN** the system SHALL return `{ text: null, timestamps: null, synchronized: false, source: null }` without error

#### Scenario: .lrc file exists but has no valid timestamp lines
- **WHEN** a sibling `.lrc` file exists but contains no line matching the `[mm:ss.xx]` timestamp format
- **THEN** the system SHALL treat it as if no `.lrc` file was found and fall back to embedded tag lookup

### Requirement: LRC Format Parsing
The system SHALL parse standard `.lrc` file syntax: lines of the form `[mm:ss.xx]text` (hundredths or milliseconds), including lines with multiple leading timestamp tags (e.g. `[00:12.00][00:45.00]text`) mapping to multiple entries with the same text. Non-timestamp metadata lines (e.g. `[ar:Artist]`, `[ti:Title]`) SHALL be ignored, not treated as parse errors.

#### Scenario: Line with multiple timestamps
- **WHEN** an `.lrc` line reads `[00:12.00][00:45.00]Hello world`
- **THEN** the system SHALL produce two timestamp entries, both with text "Hello world", at 12.0s and 45.0s respectively

#### Scenario: Metadata header lines are ignored
- **WHEN** an `.lrc` file begins with `[ar:Some Artist]` and `[ti:Some Title]` before any timestamped lyric line
- **THEN** the system SHALL skip those lines without producing timestamp entries or failing the parse

### Requirement: Synced Lyrics Display in Immersive Mode
The system SHALL display lyrics in the Immersive Mode view. When timestamped lyrics are available, the currently active line SHALL be visually highlighted and kept in view (auto-scroll) as playback progresses, based on the current playback position. When only plain-text lyrics are available, the system SHALL display them as static scrollable text with no line highlighting. When no lyrics are available, the system SHALL display a placeholder message.

#### Scenario: Synchronized lyrics highlight the active line during playback
- **WHEN** a track with synchronized lyrics is playing and playback position passes a lyric line's timestamp
- **THEN** that line SHALL become visually highlighted and scrolled into view, replacing the highlight on the previously active line

#### Scenario: Seeking updates the highlighted line immediately
- **WHEN** the user seeks to a new playback position via the progress bar
- **THEN** the highlighted lyric line SHALL update to match the line whose timestamp is at or immediately before the new position, without waiting for the next natural playback tick beyond the existing progress update interval

#### Scenario: Unsynced lyrics show as static text
- **WHEN** the current track has only unsynchronized (plain text) lyrics
- **THEN** the Immersive Mode lyrics panel SHALL render the full text as scrollable content with no active-line highlighting

#### Scenario: No lyrics available
- **WHEN** the current track has no lyrics from any source
- **THEN** the Immersive Mode lyrics panel SHALL display a "No lyrics found" placeholder instead of an empty area

### Requirement: Lyrics Fetch Lifecycle
The system SHALL fetch lyrics for a track automatically when it becomes the current track, and SHALL clear previously displayed lyrics before the new track's lyrics resolve, so stale lyrics from a prior track are never shown against a new track's audio.

#### Scenario: Switching tracks clears old lyrics first
- **WHEN** playback switches from Track A (with lyrics) to Track B
- **THEN** the lyrics panel SHALL not display Track A's lyrics once Track B begins loading, even before Track B's lyrics have finished resolving
