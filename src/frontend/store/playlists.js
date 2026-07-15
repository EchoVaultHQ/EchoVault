import { defineStore } from "pinia"
import { ref } from "vue"

export const usePlaylistsStore = defineStore("playlists", () => {
  const playlists = ref([])
  const loading = ref(false)

  async function attachCover(playlist) {
    if (playlist.cover) {
      const url = playlist.cover.startsWith("/")
        ? `echovault://${playlist.cover}`
        : `echovault:///${playlist.cover}`
      return { ...playlist, coverUrl: url }
    }
    return { ...playlist, coverUrl: null }
  }

  async function loadPlaylists(force = false) {
    if (playlists.value.length && !force) return
    loading.value = true
    try {
      const result = await window.api.getPlaylists()
      playlists.value = await Promise.all(result.map(attachCover))
    } catch (error) {
      console.error("playlists store :: failed to load playlists", error)
    } finally {
      loading.value = false
    }
  }

  async function createPlaylist(name) {
    await window.api.createPlaylist(name)
    await loadPlaylists(true)
  }

  async function deletePlaylist(id) {
    await window.api.deletePlaylist(id)
    await loadPlaylists(true)
  }

  async function renamePlaylist(id, name) {
    await window.api.updatePlaylist(id, name)
    await loadPlaylists(true)
  }

  return { playlists, loading, loadPlaylists, createPlaylist, deletePlaylist, renamePlaylist }
})
