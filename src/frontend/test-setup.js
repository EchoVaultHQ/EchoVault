import { vi } from "vitest"

function buildApiMock() {
  return {
    platform: "linux",

    // library
    addFolder: vi.fn(),
    getFolders: vi.fn(),
    removeFolder: vi.fn(),
    rescanLibrary: vi.fn(),
    getLastScannedAt: vi.fn(),

    // tracks
    getTracks: vi.fn(),
    getRecentTracks: vi.fn(),
    getLyrics: vi.fn(),
    toggleLike: vi.fn(),
    getLikedTracks: vi.fn(),
    getEnhancedTracks: vi.fn(),

    // artists
    getArtists: vi.fn(),
    getTracksByArtist: vi.fn(),

    // player
    playTrack: vi.fn(),
    getFileSize: vi.fn(),

    // enhance
    enhanceTrack: vi.fn(),
    enhanceCheckReady: vi.fn(),
    onEnhanceProgress: vi.fn(() => () => {}),
    onEnhanceDone: vi.fn(() => () => {}),
    onEnhanceError: vi.fn(() => () => {}),

    // toast
    showToast: vi.fn(),

    // play stats
    incrementPlayCount: vi.fn(),
    getTopPlayedTracks: vi.fn(),
    getRecentlyPlayed: vi.fn(),
    getTopPlayedArtists: vi.fn(),
    getTotalPlays: vi.fn(),
    getArtistByName: vi.fn(),
    restoreWindowSize: vi.fn(),
    enableMiniPlayer: vi.fn(),
    checkMiniMode: vi.fn(() => Promise.resolve(false)),

    // search
    searchTracks: vi.fn(),
    searchArtists: vi.fn(),
    searchAll: vi.fn(),

    // window bar
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(),
    setImmersiveMode: vi.fn(),
    resetImmersiveMode: vi.fn(),

    // logs
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),

    // playlists
    getPlaylists: vi.fn(),
    createPlaylist: vi.fn(),
    getPlaylistTracks: vi.fn(),
    addTrackToPlaylist: vi.fn(),
    removeTrackFromPlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    updatePlaylist: vi.fn(),

    // last.fm
    lastfmGetStatus: vi.fn(),
    lastfmSaveCredentials: vi.fn(),
    lastfmConnect: vi.fn(),
    lastfmConfirmAuth: vi.fn(),
    lastfmDisconnect: vi.fn(),
    lastfmSetEnabled: vi.fn(),
    lastfmNowPlaying: vi.fn(),
    lastfmScrobble: vi.fn(),

    // tray
    updateTrayNowPlaying: vi.fn(),
    onTrayControl: vi.fn(() => () => {}),

    // updates
    onUpdateAvailable: vi.fn(() => () => {}),
    openExternal: vi.fn(),
    checkForUpdates: vi.fn(),
    getAppVersion: vi.fn(),

    // profile
    profile: {
      get: vi.fn(),
      setUsername: vi.fn(),
      pickAvatar: vi.fn(),
      clearAvatar: vi.fn(),
    },
  }
}

globalThis.window.api = buildApiMock()

export function resetApiMocks() {
  globalThis.window.api = buildApiMock()
}
