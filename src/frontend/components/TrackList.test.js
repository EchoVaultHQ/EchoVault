import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { mountWithPlugins } from "../test-helpers.js"
import { useEnhanceStore } from "../store/enhance.js"
import TrackList from "./TrackList.vue"

function track(overrides = {}) {
  return {
    id: 1,
    title: "Song",
    artist: "Artist",
    album: "Album",
    duration: 200,
    file_path: "/music/song.flac",
    isLiked: false,
    ...overrides,
  }
}

function mountList(propsOverrides = {}) {
  return mountWithPlugins(TrackList, {
    props: {
      tracks: [track()],
      currentTrack: {},
      formatDuration: (s) => `${s}s`,
      playlists: [],
      currentPlaylistId: null,
      ...propsOverrides,
    },
  })
}

describe("TrackList.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("emits select with the track when a row is clicked", async () => {
    const t = track()
    const wrapper = mountList({ tracks: [t] })
    await wrapper.find(".track-row").trigger("click")
    expect(wrapper.emitted("select")[0]).toEqual([t])
  })

  describe("dropdown menu", () => {
    it("opens the menu for a track and closes it on a second click", async () => {
      const wrapper = mountList()
      const moreBtn = wrapper.find(".more-btn")

      await moreBtn.trigger("click")
      expect(wrapper.find(".dropdown-menu").exists()).toBe(true)

      await moreBtn.trigger("click")
      expect(wrapper.find(".dropdown-menu").exists()).toBe(false)
    })

    it("closes the menu when a click happens outside the component (document listener)", async () => {
      const wrapper = mountList()
      await wrapper.find(".more-btn").trigger("click")
      expect(wrapper.find(".dropdown-menu").exists()).toBe(true)

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".dropdown-menu").exists()).toBe(false)
    })

    it("lists other playlists in the add-to-playlist submenu, excluding the current one", async () => {
      const wrapper = mountList({
        playlists: [
          { id: 1, name: "Chill" },
          { id: 2, name: "Workout" },
        ],
        currentPlaylistId: 1,
      })
      await wrapper.find(".more-btn").trigger("click")
      const labels = wrapper.findAll(".sub-menu .dropdown-label").map((n) => n.text())
      expect(labels).toEqual(["Workout"])
    })

    it("shows a disabled 'No playlists found' placeholder when there are none available", async () => {
      const wrapper = mountList({ playlists: [] })
      await wrapper.find(".more-btn").trigger("click")
      const sub = wrapper.find(".sub-menu .dropdown-item")
      expect(sub.text()).toBe("No playlists found")
      expect(sub.classes()).toContain("disabled")
    })

    it("only shows 'remove from playlist' when currentPlaylistId is set", async () => {
      const withoutPlaylist = mountList({ currentPlaylistId: null })
      await withoutPlaylist.find(".more-btn").trigger("click")
      expect(withoutPlaylist.text()).not.toContain("Remove from this playlist")

      const withPlaylist = mountList({ currentPlaylistId: 5 })
      await withPlaylist.find(".more-btn").trigger("click")
      expect(withPlaylist.text()).toContain("Remove from this playlist")
    })

    it("clicking the like item toggles the like status and closes the menu", async () => {
      const t = track({ isLiked: false })
      const wrapper = mountList({ tracks: [t] })
      await wrapper.find(".more-btn").trigger("click")

      const likeItem = wrapper.findAll(".dropdown-item")[0]
      await likeItem.trigger("click")

      expect(window.api.toggleLike).toHaveBeenCalledWith(1, true)
      expect(window.api.showToast).toHaveBeenCalledWith(
        "Track Song has been added to your liked songs.",
        "success"
      )
      expect(wrapper.find(".dropdown-menu").exists()).toBe(false)
    })

    it("clicking an add-to-playlist submenu entry emits add-to-playlist and toasts", async () => {
      const t = track()
      const wrapper = mountList({
        tracks: [t],
        playlists: [{ id: 9, name: "Roadtrip" }],
      })
      await wrapper.find(".more-btn").trigger("click")
      await wrapper.find(".sub-menu .dropdown-item").trigger("click")

      expect(wrapper.emitted("add-to-playlist")[0]).toEqual([{ track: t, playlistId: 9 }])
      expect(window.api.showToast).toHaveBeenCalledWith(
        '"Song" has been added to the playlist.',
        "success"
      )
    })

    it("clicking remove-from-playlist emits remove-from-playlist and toasts", async () => {
      const t = track()
      const wrapper = mountList({ tracks: [t], currentPlaylistId: 5 })
      await wrapper.find(".more-btn").trigger("click")
      const removeItem = wrapper.findAll(".dropdown-item").find((n) => n.classes().includes("danger"))
      await removeItem.trigger("click")

      expect(wrapper.emitted("remove-from-playlist")[0]).toEqual([{ track: t, playlistId: 5 }])
      expect(window.api.showToast).toHaveBeenCalledWith(
        '"Song" has been removed from the playlist.',
        "success"
      )
    })
  })

  describe("enhanceLabel", () => {
    it("shows the download-phase icon with percentage", () => {
      const wrapper = mountList({ tracks: [track({ id: 42 })] })
      const enhanceStore = useEnhanceStore()
      enhanceStore.progress[42] = { phase: "download", pct: 30, message: "" }
      expect(wrapper.vm.enhanceLabel(42)).toBe("⬇ 30%")
    })

    it("shows the default enhance icon without a percentage when pct is null", () => {
      const wrapper = mountList({ tracks: [track({ id: 42 })] })
      const enhanceStore = useEnhanceStore()
      enhanceStore.progress[42] = { phase: "enhance", pct: null, message: "" }
      expect(wrapper.vm.enhanceLabel(42)).toBe("✨")
    })

    it("returns an empty string when there is no progress entry", () => {
      const wrapper = mountList({ tracks: [track({ id: 42 })] })
      expect(wrapper.vm.enhanceLabel(42)).toBe("")
    })
  })
})
