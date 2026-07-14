import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { flushPromises } from "@vue/test-utils"
import { mountWithPlugins, createTestRouter } from "../test-helpers.js"
import { usePlaylistsStore } from "../store/playlists.js"
import { useProfileStore } from "../store/profile.js"
import { usePlayerStore } from "../store/player.js"
import HomePage from "./HomePage.vue"

vi.mock("../utils/coverColor.js", () => ({
  extractCoverColor: vi.fn(() => Promise.resolve(null)),
}))

function stubRaf() {
  const queue = []
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    queue.push(cb)
    return queue.length
  })
  return queue
}

function runAnimationToCompletion(queue) {
  const cb = queue.shift()
  cb(performance.now() + 5000) // far past the 1200ms easing duration
}

async function mountHome({
  tracks = [],
  artists = [],
  folders = [{ id: 1, path: "/music" }],
  topPlayed = [],
} = {}) {
  window.api.getTracks.mockResolvedValue(tracks)
  window.api.getArtists.mockResolvedValue(artists)
  window.api.getFolders.mockResolvedValue(folders)
  window.api.getTopPlayedTracks.mockResolvedValue(topPlayed)
  const wrapper = mountWithPlugins(HomePage)
  await flushPromises()
  return wrapper
}

describe("HomePage.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe("greeting", () => {
    it.each([
      [6, "Good morning"],
      [14, "Good afternoon"],
      [19, "Good evening"],
      [23, "Good night"],
    ])("shows '%s' at hour %s → expected text %s", async (hour, expected) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 1, hour))
      const queue = stubRaf()
      const wrapper = await mountHome()
      runAnimationToCompletion(queue)
      expect(wrapper.find(".greeting-text").text()).toBe(expected)
    })

    it("appends the profile username when set", async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 1, 6))
      stubRaf()
      const profile = useProfileStore()
      profile.username = "royal"
      const wrapper = await mountHome()
      expect(wrapper.find(".greeting-text").text()).toBe("Good morning, royal")
    })
  })

  it("dedups album counts, excluding tracks with no album", async () => {
    const queue = stubRaf()
    const wrapper = await mountHome({
      tracks: [
        { id: 1, album: "A" },
        { id: 2, album: "A" },
        { id: 3, album: "B" },
        { id: 4, album: null },
      ],
    })
    runAnimationToCompletion(queue)
    expect(wrapper.text()).toContain("2") // totalAlbums
  })

  it("converges animated tracks/artists to the final stats after the animation loop completes", async () => {
    const queue = stubRaf()
    const wrapper = await mountHome({
      tracks: [{ id: 1, album: "A" }, { id: 2, album: "B" }],
      artists: [{ id: 1 }, { id: 2 }, { id: 3 }],
    })
    runAnimationToCompletion(queue)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain("2") // animatedTracks converged
    expect(wrapper.text()).toContain("3") // animatedArtists converged
  })

  it("shows the empty-library state when there are no folders", async () => {
    const queue = stubRaf()
    const wrapper = await mountHome({ folders: [] })
    runAnimationToCompletion(queue)
    expect(wrapper.find(".empty-state").exists()).toBe(true)
    expect(wrapper.find(".home-body").exists()).toBe(false)
  })

  it("renders the library body when folders exist", async () => {
    const queue = stubRaf()
    const wrapper = await mountHome({ folders: [{ id: 1, path: "/music" }] })
    runAnimationToCompletion(queue)
    expect(wrapper.find(".empty-state").exists()).toBe(false)
    expect(wrapper.find(".home-body").exists()).toBe(true)
  })

  describe("playTrack", () => {
    it("rebuilds the queue from top tracks the first time, and does not re-clear it on a second click", async () => {
      const queue = stubRaf()
      const t1 = { id: 1, title: "One", file_path: "/one.flac" }
      const t2 = { id: 2, title: "Two", file_path: "/two.flac" }
      const wrapper = await mountHome({ topPlayed: [t1, t2] })
      runAnimationToCompletion(queue)
      await wrapper.vm.$nextTick()

      const player = usePlayerStore()
      const clearSpy = vi.spyOn(player, "clearQueue")

      const rows = wrapper.findAll(".track-row")
      await rows[0].trigger("click")
      expect(clearSpy).toHaveBeenCalledOnce()
      expect(player.queueSource).toBe("home-top-played")
      expect(player.currentIndex).toBe(0)

      await rows[1].trigger("click")
      expect(clearSpy).toHaveBeenCalledOnce() // not called again — queueSource already matches
      expect(player.currentIndex).toBe(1)
    })
  })

  describe("cover tint", () => {
    it("falls back to the default tint when extractCoverColor resolves null", async () => {
      const queue = stubRaf()
      const wrapper = await mountHome()
      runAnimationToCompletion(queue)
      const heroArt = wrapper.find(".hero-art")
      expect(heroArt.attributes("style")).toContain("124, 58, 237")
    })
  })

  describe("navigation", () => {
    it("clicking the Liked card navigates to /playlists/liked", async () => {
      const queue = stubRaf()
      const router = createTestRouter()
      const pushSpy = vi.spyOn(router, "push")
      window.api.getTracks.mockResolvedValue([])
      window.api.getArtists.mockResolvedValue([])
      window.api.getFolders.mockResolvedValue([{ id: 1, path: "/music" }])
      window.api.getTopPlayedTracks.mockResolvedValue([])
      const wrapper = mountWithPlugins(HomePage, { router })
      await flushPromises()
      runAnimationToCompletion(queue)

      await wrapper.find(".playlist-card.liked").trigger("click")
      expect(pushSpy).toHaveBeenCalledWith("/playlists/liked")
    })

    it("clicking a playlist card navigates to /playlists/:id", async () => {
      const queue = stubRaf()
      const router = createTestRouter()
      const pushSpy = vi.spyOn(router, "push")
      const wrapper = mountWithPlugins(HomePage, { router })
      const playlistsStore = usePlaylistsStore()
      playlistsStore.playlists = [{ id: 42, name: "Roadtrip", track_count: 3 }]
      await flushPromises()
      runAnimationToCompletion(queue)
      await wrapper.vm.$nextTick()

      const cards = wrapper.findAll(".playlist-card")
      await cards[1].trigger("click")
      expect(pushSpy).toHaveBeenCalledWith("/playlists/42")
    })
  })
})
