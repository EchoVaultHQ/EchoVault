## ADDED Requirements

### Requirement: Theme selection persists across app restarts
The system SHALL retain the user's last-selected theme (`light` or `dark`) across a full application quit and relaunch.

#### Scenario: User selects a theme then restarts the app
- **WHEN** the user selects a theme in Settings and then fully quits and relaunches the app
- **THEN** the app launches with the previously selected theme applied, not the hardcoded default

#### Scenario: App quits via window-all-closed on non-macOS platforms
- **WHEN** the last window is closed on Windows/Linux, triggering the `window-all-closed` shutdown path
- **THEN** the app shuts down through the standard Electron quit sequence (no forced `app.exit()`) so pending storage writes are flushed before the process terminates

#### Scenario: No theme ever selected
- **WHEN** the user has never selected a theme (no saved value)
- **THEN** the app falls back to system color-scheme preference, or `dark` if unavailable, as before
