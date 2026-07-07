## ADDED Requirements

### Requirement: Online Lyrics Fallback
The system SHALL query lrclib.org for synced lyrics when a track has no `.lrc` sidecar file and no embedded lyrics tags, and the online-lookup setting is enabled. The system SHALL NOT query lrclib.org when either a local source already produced lyrics, or the setting is disabled.

#### Scenario: No local lyrics, online lookup enabled, match found
- **WHEN** a track has no `.lrc` file, no embedded lyrics tags, and the "Fetch lyrics online" setting is enabled
- **THEN** the system SHALL query lrclib.org using the track's artist, title, album (if known), and duration, and return the matched synced lyrics if found

#### Scenario: Local .lrc or embedded lyrics already exist
- **WHEN** a track has a valid `.lrc` file or embedded lyrics tag
- **THEN** the system SHALL NOT query lrclib.org, regardless of the online-lookup setting

#### Scenario: Online lookup disabled
- **WHEN** a track has no local lyrics and the "Fetch lyrics online" setting is disabled
- **THEN** the system SHALL skip the online lookup entirely and return the "no lyrics found" result

#### Scenario: No match found online
- **WHEN** lrclib.org is queried and returns no matching track
- **THEN** the system SHALL return the "no lyrics found" result without error

#### Scenario: Network failure or timeout
- **WHEN** the lrclib.org request fails, times out (~5s), or the device is offline
- **THEN** the system SHALL catch the failure, return the "no lyrics found" result, and SHALL NOT surface a visible error to the user beyond the existing lyrics placeholder

### Requirement: Persist Successful Online Matches
When lrclib.org returns a synced-lyrics match, the system SHALL write the result to a `.lrc` file next to the source audio file (same basename, `.lrc` extension), so subsequent lookups for that track use the local file without a network call.

#### Scenario: Successful match is written to disk
- **WHEN** lrclib.org returns synced lyrics for a track at `/music/Song.mp3`
- **THEN** the system SHALL write those lyrics in `.lrc` format to `/music/Song.lrc`

#### Scenario: Write fails but lyrics still display this session
- **WHEN** writing the `.lrc` file fails (e.g. read-only folder, permissions error)
- **THEN** the system SHALL still return the fetched lyrics for the current request, and SHALL NOT error out or block playback

#### Scenario: Subsequent play uses the persisted file, no network call
- **WHEN** a track previously matched online is played again in a later session
- **THEN** the system SHALL find the now-existing `.lrc` file via the standard local-lookup step and SHALL NOT query lrclib.org again for that track

### Requirement: Session-Level Negative Cache
The system SHALL avoid re-querying lrclib.org for the same track within a single app session after a lookup already returned no match.

#### Scenario: Replaying a track with no online match does not re-query
- **WHEN** a track was queried earlier in the current app session and lrclib.org returned no match
- **THEN** the system SHALL skip the network request on subsequent plays of that same track within the same session, returning "no lyrics found" directly

#### Scenario: Negative cache does not persist across app restarts
- **WHEN** the app is restarted after a track previously returned no online match
- **THEN** the system SHALL attempt the online lookup again for that track on next play

### Requirement: Online Lyrics Lookup Setting
The system SHALL provide a Settings toggle, "Fetch lyrics online," defaulting to enabled, that controls whether the online lookup step runs. The setting SHALL persist across app restarts.

#### Scenario: Default state is enabled
- **WHEN** the app is launched for the first time with no prior setting saved
- **THEN** online lyrics lookup SHALL be enabled by default

#### Scenario: User disables the setting
- **WHEN** the user toggles "Fetch lyrics online" off in Settings
- **THEN** the system SHALL persist that preference and SHALL NOT perform online lookups on subsequent lyrics requests, including after an app restart
