## ADDED Requirements

### Requirement: Correct lrclib API Host
The system SHALL query `lrclib.net` (not `lrclib.org`) for online lyrics lookups.

#### Scenario: Request targets the correct host
- **WHEN** the system performs an online lyrics lookup
- **THEN** the request SHALL be sent to `lrclib.net`'s API

### Requirement: Identifying User-Agent on lrclib Requests
The system SHALL send a descriptive `User-Agent` header (identifying the application name and version) on every request to lrclib.net's API.

#### Scenario: Request includes a descriptive User-Agent
- **WHEN** the system queries lrclib.net for lyrics (album-qualified or album-less attempt)
- **THEN** the outgoing request SHALL include a `User-Agent` header identifying the application, not a generic/default value

### Requirement: Diagnosable Online Lookup Failures
The system SHALL determine and record a specific reason when an online lyrics lookup produces no result, distinguishing at minimum: an HTTP error status, a network/connection failure, a request timeout, and a successful response with no synced lyrics available.

#### Scenario: HTTP error status is distinguishable from network failure
- **WHEN** an online lookup fails because the server returned a non-success HTTP status
- **THEN** the recorded failure reason SHALL reflect that status, distinct from a network-level failure

#### Scenario: Network/connection failure is recorded
- **WHEN** an online lookup fails because the request could not reach the server (DNS failure, connection refused, etc.)
- **THEN** the recorded failure reason SHALL reflect a network-level failure, including the underlying error detail

#### Scenario: Successful response with no synced lyrics is distinguishable from a failed request
- **WHEN** lrclib.net returns a successful response for a track but it has no synced-lyrics field
- **THEN** the recorded failure reason SHALL reflect "no synced lyrics available," distinct from a network or HTTP failure

### Requirement: Failure Reason Visible in Logs
When an online lookup misses, the system SHALL log the failure reason in the main-process log and SHALL include it in the response so the renderer can log it to the DevTools console.

#### Scenario: Main-process log shows the failure reason
- **WHEN** an online lookup misses for a track
- **THEN** the main-process log line for that miss SHALL include the specific failure reason, not just that a miss occurred

#### Scenario: Renderer console shows the failure reason
- **WHEN** an online lookup misses for a track
- **THEN** the renderer's console log for that track's lyrics fetch SHALL include the failure reason
