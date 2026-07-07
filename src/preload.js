import { contextBridge, ipcRenderer } from "electron"
import log from "electron-log/renderer"

contextBridge.exposeInMainWorld("api", {
  // library
  addFolder: () => ipcRenderer.invoke("library:add-folder"),
  getFolders: () => ipcRenderer.invoke("library:get-folders"),
  removeFolder: (path) => ipcRenderer.invoke("library:remove-folder", path),
  rescanLibrary: () => ipcRenderer.invoke("library:rescan-library"),

  // tracks
  getTracks: () => ipcRenderer.invoke("tracks:get-tracks"),
  getLyrics: (filePath, options) =>
    ipcRenderer.invoke("tracks:get-lyrics", filePath, options),
  toggleLike: (trackId, isLiked) =>
    ipcRenderer.invoke("tracks:updateLike", trackId, isLiked),
  getLikedTracks: () => ipcRenderer.invoke("tracks:get-liked-tracks"),

  // artists
  getArtists: () => ipcRenderer.invoke("artists:get-artists"),
  getTracksByArtist: (artistId) =>
    ipcRenderer.invoke("artists:get-tracks-by-artist", artistId),

  // player
  playTrack: (track) => ipcRenderer.invoke("player:play", track),
  streamChunk: (trackPath, offset, size) =>
    ipcRenderer.invoke("player:streamChunk", trackPath, offset, size),
  getFileSize: (trackPath) =>
    ipcRenderer.invoke("player:getFileSize", trackPath),

  // toast
  showToast: (message, type = "info") => {
    document.dispatchEvent(
      new CustomEvent("show-toast", { detail: { message, type } })
    )
  },

  // Play count APIs
  incrementPlayCount: (trackId) =>
    ipcRenderer.invoke("increment-play-count", trackId),
  getTopPlayedTracks: () => ipcRenderer.invoke("get-top-played-tracks"),
  getTopPlayedArtists: () => ipcRenderer.invoke("get-top-played-artists"),
  getTotalPlays: () => ipcRenderer.invoke("get-total-plays"),
  getArtistByName: (name) => ipcRenderer.invoke("get-artist-by-name", name),
  restoreWindowSize: () => ipcRenderer.invoke("restore-window-size"),
  enableMiniPlayer: () => ipcRenderer.invoke("enable-mini-player"),

  // Search
  searchTracks: (payload) => ipcRenderer.invoke("search:tracks", payload),
  searchArtists: (query) => ipcRenderer.invoke("search:artists", query),

  // window bar
  minimize: () => ipcRenderer.send("win:minimize"),
  maximize: () => ipcRenderer.send("win:maximize"),
  close: () => ipcRenderer.send("win:close"),
  isMaximized: () => ipcRenderer.invoke("win:isMaximized"),
  setImmersiveMode: () => ipcRenderer.invoke("win:set-immersive-mode"),
  resetImmersiveMode: () => ipcRenderer.invoke("win:reset-immersive-mode"),

  // logs
  info: (message) => log.info(message),
  error: (message) => log.error(message),
  warn: (message) => log.warn(message),
  debug: (message) => log.debug(message),

  // playlist
  getPlaylists: () => ipcRenderer.invoke("get-playlists"),
  createPlaylist: (name) => ipcRenderer.invoke("create-playlist", name),
  getPlaylistTracks: (playlistId) =>
    ipcRenderer.invoke("get-playlist-tracks", playlistId),
  addTrackToPlaylist: (playlistId, trackId) =>
    ipcRenderer.invoke("add-track-to-playlist", playlistId, trackId),
  removeTrackFromPlaylist: (playlistId, trackId) =>
    ipcRenderer.invoke("remove-track-from-playlist", playlistId, trackId),
  deletePlaylist: (playlistId) =>
    ipcRenderer.invoke("delete-playlist", playlistId),
  updatePlaylist: (playlistId, name) =>
    ipcRenderer.invoke("update-playlist", playlistId, name),
})
