import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { usePlaylistsStore } from "./playlists.js"

describe("usePlaylistsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe("loadPlaylists", () => {
    it("fetches playlists and attaches an echovault:// cover url for an absolute path", async () => {
      window.api.getPlaylists.mockResolvedValue([
        { id: 1, name: "Liked", cover: "/covers/liked.jpg" },
      ])
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      expect(store.playlists).toEqual([
        { id: 1, name: "Liked", cover: "/covers/liked.jpg", coverUrl: "echovault:///covers/liked.jpg" },
      ])
    })

    it("attaches a relative-path cover url", async () => {
      window.api.getPlaylists.mockResolvedValue([
        { id: 1, name: "Liked", cover: "covers/liked.jpg" },
      ])
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      expect(store.playlists[0].coverUrl).toBe("echovault:///covers/liked.jpg")
    })

    it("sets coverUrl to null when the playlist has no cover", async () => {
      window.api.getPlaylists.mockResolvedValue([{ id: 2, name: "Empty", cover: null }])
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      expect(store.playlists[0].coverUrl).toBeNull()
    })

    it("skips refetching when playlists are already loaded and force is not set", async () => {
      window.api.getPlaylists.mockResolvedValue([{ id: 1, name: "Liked", cover: null }])
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      await store.loadPlaylists()
      expect(window.api.getPlaylists).toHaveBeenCalledOnce()
    })

    it("refetches when force is true even if playlists are already loaded", async () => {
      window.api.getPlaylists.mockResolvedValue([{ id: 1, name: "Liked", cover: null }])
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      await store.loadPlaylists(true)
      expect(window.api.getPlaylists).toHaveBeenCalledTimes(2)
    })

    it("toggles loading true then false, and swallows errors", async () => {
      window.api.getPlaylists.mockRejectedValue(new Error("boom"))
      const store = usePlaylistsStore()
      await store.loadPlaylists()
      expect(store.loading).toBe(false)
      expect(store.playlists).toEqual([])
    })
  })

  describe("createPlaylist", () => {
    it("creates a playlist then force-reloads the list", async () => {
      window.api.createPlaylist.mockResolvedValue({ id: 3 })
      window.api.getPlaylists.mockResolvedValue([{ id: 3, name: "New", cover: null }])
      const store = usePlaylistsStore()
      await store.createPlaylist("New")
      expect(window.api.createPlaylist).toHaveBeenCalledWith("New")
      expect(window.api.getPlaylists).toHaveBeenCalledOnce()
      expect(store.playlists).toHaveLength(1)
    })
  })

  describe("deletePlaylist", () => {
    it("deletes a playlist then force-reloads the list", async () => {
      window.api.deletePlaylist.mockResolvedValue(undefined)
      window.api.getPlaylists.mockResolvedValue([])
      const store = usePlaylistsStore()
      await store.deletePlaylist(3)
      expect(window.api.deletePlaylist).toHaveBeenCalledWith(3)
      expect(window.api.getPlaylists).toHaveBeenCalledOnce()
    })
  })

  describe("renamePlaylist", () => {
    it("renames a playlist then force-reloads the list", async () => {
      window.api.updatePlaylist.mockResolvedValue(undefined)
      window.api.getPlaylists.mockResolvedValue([{ id: 3, name: "New Name", cover: null }])
      const store = usePlaylistsStore()
      await store.renamePlaylist(3, "New Name")
      expect(window.api.updatePlaylist).toHaveBeenCalledWith(3, "New Name")
      expect(window.api.getPlaylists).toHaveBeenCalledOnce()
    })
  })
})
