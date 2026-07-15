import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { flushPromises } from "@vue/test-utils"
import { mountWithPlugins, createTestRouter } from "../test-helpers.js"
import { usePlayerStore } from "../store/player.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { useEnhanceStore } from "../store/enhance.js"
import TrackList from "./TrackList.vue"
import TrackSortControls from "./TrackSortControls.vue"
import Playlists from "./Playlists.vue"

function track(overrides = {}) {
  return {
    id: 1,
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 200,
    file_path: "/song.flac",
    cover: null,
    ...overrides,
  }
}

async function mountPlaylists(path = "/playlists") {
  const router = createTestRouter([
    { path: "/playlists", component: { template: "<div/>" } },
    { path: "/playlists/:id", component: { template: "<div/>" } },
  ])
  router.push(path)
  await router.isReady()
  const wrapper = mountWithPlugins(Playlists, { router, shallow: true })
  await flushPromises()
  return { wrapper, router }
}

describe("Playlists.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    window.api.getLikedTracks.mockResolvedValue([])
    window.api.getEnhancedTracks.mockResolvedValue([])
    window.api.getPlaylistTracks.mockResolvedValue([])
  })

  describe("cover placeholder", () => {
    it("shows the dashed cover placeholder when the playlist has no cover", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      playlistsStore.playlists = [{ id: 42, name: "Roadtrip", coverUrl: null }]
      await wrapper.vm.$nextTick()

      expect(wrapper.find(".cover-placeholder-title").exists()).toBe(true)
      expect(wrapper.find(".hero-cover-image").exists()).toBe(false)
    })

    it("shows the real cover image instead of the placeholder when one exists", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      playlistsStore.playlists = [{ id: 42, name: "Roadtrip", coverUrl: "echovault:///x.jpg" }]
      await wrapper.vm.$nextTick()

      expect(wrapper.find(".cover-placeholder-title").exists()).toBe(false)
      expect(wrapper.find(".hero-cover-image").exists()).toBe(true)
    })
  })

  describe("playlist-meta duration", () => {
    it("shows track count and total duration formatted as Xh Ym / Xm", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([
        track({ id: 1, duration: 60 }),
        track({ id: 2, duration: 120 }),
      ])
      const { wrapper } = await mountPlaylists("/playlists/42")
      expect(wrapper.find(".playlist-meta").text()).toBe("2 tracks · 3m")
    })
  })

  describe("more options menu", () => {
    it("is hidden for the liked/enhanced pseudo-playlists", async () => {
      const { wrapper } = await mountPlaylists("/playlists/liked")
      expect(wrapper.find(".hero-more").exists()).toBe(false)
    })

    it("opens on click for a real playlist and lists rename + delete", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      await wrapper.find(".more-options-btn").trigger("click")

      expect(wrapper.find(".hero-menu").exists()).toBe(true)
      const labels = wrapper.findAll(".hero-menu .dropdown-item").map((n) => n.text())
      expect(labels).toEqual(["Rename", "Delete playlist"])
    })

    it("clicking Delete reuses the existing deletePlaylist flow", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true)
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      const deleteSpy = vi.spyOn(playlistsStore, "deletePlaylist").mockResolvedValue(undefined)

      await wrapper.find(".more-options-btn").trigger("click")
      await wrapper.find(".hero-menu .dropdown-item.danger").trigger("click")

      expect(deleteSpy).toHaveBeenCalledWith("42")
    })

    it("clicking Rename opens a dialog pre-filled with the current name, and confirming renames it", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      playlistsStore.playlists = [{ id: 42, name: "Roadtrip", coverUrl: null }]
      await wrapper.vm.$nextTick()
      const renameSpy = vi.spyOn(playlistsStore, "renamePlaylist").mockResolvedValue(undefined)

      await wrapper.find(".more-options-btn").trigger("click")
      await wrapper.find(".hero-menu .dropdown-item:not(.danger)").trigger("click")

      expect(wrapper.vm.showRenameDialog).toBe(true)
      expect(wrapper.vm.renamePlaylistName).toBe("Roadtrip")

      wrapper.vm.renamePlaylistName = "Night Drive"
      await wrapper.vm.confirmRename()

      expect(renameSpy).toHaveBeenCalledWith("42", "Night Drive")
      expect(wrapper.vm.showRenameDialog).toBe(false)
    })
  })

  describe("coverDataUrl branch (via loadLikedTracks)", () => {
    it("builds echovault:// urls for absolute/relative covers, and null for no cover", async () => {
      window.api.getLikedTracks.mockResolvedValue([
        track({ id: 1, cover: "/covers/a.jpg" }),
        track({ id: 2, cover: "covers/b.jpg" }),
        track({ id: 3, cover: null }),
      ])
      const { wrapper } = await mountPlaylists("/playlists/liked")
      const tracks = wrapper.findComponent(TrackList).props("tracks")
      expect(tracks[0].coverDataUrl).toBe("echovault:///covers/a.jpg")
      expect(tracks[1].coverDataUrl).toBe("echovault:///covers/b.jpg")
      expect(tracks[2].coverDataUrl).toBeNull()
    })
  })

  describe("selectedPlaylist 3-way branch", () => {
    it("liked route: shows Liked Songs and the liked-tracks list", async () => {
      window.api.getLikedTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/liked")
      expect(wrapper.find(".hero-info h1").text()).toBe("Liked Songs")
      expect(wrapper.findComponent(TrackList).props("tracks")).toHaveLength(1)
    })

    it("enhanced route: shows Enhanced Songs and the enhanced-tracks list", async () => {
      window.api.getEnhancedTracks.mockResolvedValue([track({ id: 1 }), track({ id: 2 })])
      const { wrapper } = await mountPlaylists("/playlists/enhanced")
      expect(wrapper.find(".hero-info h1").text()).toBe("Enhanced Songs")
      expect(wrapper.findComponent(TrackList).props("tracks")).toHaveLength(2)
    })

    it("real playlist id: shows the playlist's own name, cover, and tracks", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      playlistsStore.playlists = [{ id: 42, name: "Roadtrip", coverUrl: "echovault:///x.jpg" }]
      await wrapper.vm.$nextTick()

      expect(wrapper.find(".hero-info h1").text()).toBe("Roadtrip")
      expect(wrapper.find(".hero-cover-image").attributes("src")).toBe("echovault:///x.jpg")
      expect(wrapper.findComponent(TrackList).props("tracks")).toHaveLength(1)
    })
  })

  describe("createPlaylist", () => {
    it("does not create a playlist when the name is empty/whitespace", async () => {
      const { wrapper } = await mountPlaylists()
      const playlistsStore = usePlaylistsStore()
      const createSpy = vi.spyOn(playlistsStore, "createPlaylist")

      wrapper.vm.newPlaylistName = "   "
      await wrapper.vm.createPlaylist()
      expect(createSpy).not.toHaveBeenCalled()
    })

    it("creates the playlist with the trimmed name, then resets/closes the dialog", async () => {
      const { wrapper } = await mountPlaylists()
      const playlistsStore = usePlaylistsStore()
      const createSpy = vi.spyOn(playlistsStore, "createPlaylist").mockResolvedValue(undefined)

      wrapper.vm.showCreateDialog = true
      wrapper.vm.newPlaylistName = "  Roadtrip  "
      await wrapper.vm.createPlaylist()

      expect(createSpy).toHaveBeenCalledWith("Roadtrip")
      expect(wrapper.vm.newPlaylistName).toBe("")
      expect(wrapper.vm.showCreateDialog).toBe(false)
    })
  })

  describe("deletePlaylist", () => {
    it("does nothing when the user cancels the confirm dialog", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false)
      const { wrapper } = await mountPlaylists("/playlists/7")
      const playlistsStore = usePlaylistsStore()
      const deleteSpy = vi.spyOn(playlistsStore, "deletePlaylist")

      await wrapper.vm.deletePlaylist(7)
      expect(deleteSpy).not.toHaveBeenCalled()
    })

    it("deletes and navigates back only when the deleted playlist is the one being viewed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true)
      const { wrapper, router } = await mountPlaylists("/playlists/7")
      const playlistsStore = usePlaylistsStore()
      vi.spyOn(playlistsStore, "deletePlaylist").mockResolvedValue(undefined)
      const pushSpy = vi.spyOn(router, "push")

      await wrapper.vm.deletePlaylist(7)
      expect(playlistsStore.deletePlaylist).toHaveBeenCalledWith(7)
      expect(pushSpy).toHaveBeenCalledWith("/playlists")
    })

    it("deletes but does not navigate when deleting a different playlist than the one being viewed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true)
      const { wrapper, router } = await mountPlaylists("/playlists/7")
      const playlistsStore = usePlaylistsStore()
      vi.spyOn(playlistsStore, "deletePlaylist").mockResolvedValue(undefined)
      const pushSpy = vi.spyOn(router, "push")

      await wrapper.vm.deletePlaylist(9)
      expect(playlistsStore.deletePlaylist).toHaveBeenCalledWith(9)
      expect(pushSpy).not.toHaveBeenCalled()
    })
  })

  describe("playTrack", () => {
    it("rebuilds the queue on first play, then reuses it and finds the track by index on the next play", async () => {
      const t1 = track({ id: 1, file_path: "/one.flac" })
      const t2 = track({ id: 2, file_path: "/two.flac" })
      window.api.getLikedTracks.mockResolvedValue([t1, t2])
      const { wrapper } = await mountPlaylists("/playlists/liked")
      const player = usePlayerStore()
      const clearSpy = vi.spyOn(player, "clearQueue")
      const setTrackSpy = vi.spyOn(player, "setTrack")

      wrapper.vm.playTrack(t1)
      expect(clearSpy).toHaveBeenCalledOnce()
      expect(player.queueSource).toBe("liked")
      expect(player.currentIndex).toBe(0)
      expect(setTrackSpy).toHaveBeenLastCalledWith(player.queue[0], false)

      wrapper.vm.playTrack({ ...track({ id: 99, file_path: "/not-queued.flac" }) })
      expect(clearSpy).toHaveBeenCalledOnce() // not rebuilt again — queueSource already "liked"
      expect(setTrackSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ file_path: "/not-queued.flac" })
      )
    })
  })

  describe("handleAddToPlaylist / handleRemoveFromPlaylist", () => {
    it("reloads playlists and the currently-viewed playlist's tracks after adding", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      const loadSpy = vi.spyOn(playlistsStore, "loadPlaylists").mockResolvedValue(undefined)

      await wrapper.findComponent(TrackList).vm.$emit("add-to-playlist", {
        track: track({ id: 5 }),
        playlistId: "42",
      })
      await flushPromises()

      expect(window.api.addTrackToPlaylist).toHaveBeenCalledWith("42", 5)
      expect(loadSpy).toHaveBeenCalledWith(true)
      expect(window.api.getPlaylistTracks).toHaveBeenCalledTimes(2) // initial mount + reload
    })

    it("does not reload the currently-viewed tracks when adding to a different playlist", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      vi.spyOn(playlistsStore, "loadPlaylists").mockResolvedValue(undefined)

      await wrapper.findComponent(TrackList).vm.$emit("add-to-playlist", {
        track: track({ id: 5 }),
        playlistId: "77",
      })
      await flushPromises()

      expect(window.api.getPlaylistTracks).toHaveBeenCalledTimes(1) // only the initial mount load
    })

    it("removing always reloads that playlist's tracks and the playlists list", async () => {
      window.api.getPlaylistTracks.mockResolvedValue([track({ id: 1 })])
      const { wrapper } = await mountPlaylists("/playlists/42")
      const playlistsStore = usePlaylistsStore()
      const loadSpy = vi.spyOn(playlistsStore, "loadPlaylists").mockResolvedValue(undefined)

      await wrapper.findComponent(TrackList).vm.$emit("remove-from-playlist", {
        track: track({ id: 5 }),
        playlistId: "42",
      })
      await flushPromises()

      expect(window.api.removeTrackFromPlaylist).toHaveBeenCalledWith("42", 5)
      expect(window.api.getPlaylistTracks).toHaveBeenCalledTimes(2)
      expect(loadSpy).toHaveBeenCalledWith(true)
    })
  })

  describe("route-param watcher", () => {
    it("does not load playlist tracks for the liked/enhanced pseudo-ids", async () => {
      await mountPlaylists("/playlists/liked")
      expect(window.api.getPlaylistTracks).not.toHaveBeenCalled()
    })

    it("loads playlist tracks immediately for a real id", async () => {
      await mountPlaylists("/playlists/42")
      expect(window.api.getPlaylistTracks).toHaveBeenCalledWith("42")
    })
  })

  describe("TrackSortControls wiring", () => {
    it("re-sorts the tracks passed to TrackList when the sort field changes", async () => {
      window.api.getLikedTracks.mockResolvedValue([
        track({ id: 1, title: "Bravo" }),
        track({ id: 2, title: "Alpha" }),
      ])
      const { wrapper } = await mountPlaylists("/playlists/liked")

      await wrapper.findComponent(TrackSortControls).vm.$emit("update:sortField", "name")
      await wrapper.vm.$nextTick()

      const titles = wrapper.findComponent(TrackList).props("tracks").map((t) => t.title)
      expect(titles).toEqual(["Alpha", "Bravo"])
    })
  })

  describe("watchers", () => {
    it("re-loads liked tracks when player.likedUpdated changes", async () => {
      const { wrapper } = await mountPlaylists()
      const player = usePlayerStore()
      player.likedUpdated++
      await flushPromises()
      expect(window.api.getLikedTracks).toHaveBeenCalledTimes(2)
    })

    it("re-loads enhanced tracks when enhanceStore.completedCount changes", async () => {
      const { wrapper } = await mountPlaylists()
      const enhanceStore = useEnhanceStore()
      enhanceStore.completedCount++
      await flushPromises()
      expect(window.api.getEnhancedTracks).toHaveBeenCalledTimes(2)
    })
  })
})
