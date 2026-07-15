import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { flushPromises } from "@vue/test-utils"
import { Play, Pause, Minimize2, Maximize2 } from "@lucide/vue"
import { mountWithPlugins, createTestRouter } from "../test-helpers.js"
import { usePlayerStore } from "../store/player.js"

vi.mock("../utils/coverColor.js", () => ({
  extractCoverColor: vi.fn(() => Promise.resolve(null)),
}))

async function mountBar({ miniActive = false, router } = {}) {
  vi.resetModules()
  window.api.checkMiniMode.mockResolvedValue(miniActive)
  const { default: PlayerBar } = await import("./PlayerBar.vue")
  setActivePinia(createPinia())
  const wrapper = mountWithPlugins(PlayerBar, { router })
  await flushPromises()
  return wrapper
}

describe("PlayerBar.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the play icon when paused, and the pause icon while playing", async () => {
    const wrapper = await mountBar()
    const player = usePlayerStore()

    player.isPlaying = false
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(Play).exists()).toBe(true)
    expect(wrapper.findComponent(Pause).exists()).toBe(false)

    player.isPlaying = true
    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(Pause).exists()).toBe(true)
  })

  it("clicking the play button delegates to the player's togglePlay action", async () => {
    const wrapper = await mountBar()
    const player = usePlayerStore()
    const toggleSpy = vi.spyOn(player, "togglePlay")

    await wrapper.find(".play-btn").trigger("click")
    expect(toggleSpy).toHaveBeenCalledOnce()
  })

  describe("prev/next", () => {
    it("disables prev/next when there is no previous/next track, and enables otherwise", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      const [, prevBtn, , nextBtn] = wrapper.findAll(".controls button")

      player.queue = [{ file_path: "a" }]
      player.currentIndex = 0
      await wrapper.vm.$nextTick()
      expect(prevBtn.attributes("disabled")).toBeDefined()
      expect(nextBtn.attributes("disabled")).toBeDefined()

      player.queue = [{ file_path: "a" }, { file_path: "b" }, { file_path: "c" }]
      player.currentIndex = 1
      await wrapper.vm.$nextTick()
      expect(prevBtn.attributes("disabled")).toBeUndefined()
      expect(nextBtn.attributes("disabled")).toBeUndefined()
    })
  })

  describe("volume", () => {
    it("wires the slider to player.setVolume and swaps to the mute icon at 0", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      const setVolumeSpy = vi.spyOn(player, "setVolume")
      const slider = wrapper.find(".volume-slider")

      await slider.setValue("0")
      expect(setVolumeSpy).toHaveBeenCalledWith(0)
    })
  })

  describe("artist navigation", () => {
    it("navigates to the artist page when artist_id is present", async () => {
      const router = createTestRouter()
      const pushSpy = vi.spyOn(router, "push")
      const wrapper = await mountBar({ router })
      const player = usePlayerStore()
      player.currentTrack = { artist: "Artist", artist_id: 7 }
      await wrapper.vm.$nextTick()

      await wrapper.find(".artist-name").trigger("click")
      expect(pushSpy).toHaveBeenCalledWith("/artists/7")
    })

    it("does nothing when there is no artist_id", async () => {
      const router = createTestRouter()
      const pushSpy = vi.spyOn(router, "push")
      const wrapper = await mountBar({ router })
      const player = usePlayerStore()
      player.currentTrack = { artist: "Artist" }
      await wrapper.vm.$nextTick()

      await wrapper.find(".artist-name").trigger("click")
      expect(pushSpy).not.toHaveBeenCalled()
    })
  })

  describe("mini player toggle (module-singleton state)", () => {
    it("enters mini-player mode and swaps the icon when starting inactive", async () => {
      const wrapper = await mountBar({ miniActive: false })
      expect(wrapper.findComponent(Maximize2).exists()).toBe(true)

      const [miniBtn] = wrapper.findAll(".track-utils button")
      await miniBtn.trigger("click")
      await wrapper.vm.$nextTick()

      expect(window.api.enableMiniPlayer).toHaveBeenCalledOnce()
      expect(wrapper.findComponent(Minimize2).exists()).toBe(true)
    })

    it("exits mini-player mode and swaps the icon back when starting active", async () => {
      const wrapper = await mountBar({ miniActive: true })
      await flushPromises()
      expect(wrapper.findComponent(Minimize2).exists()).toBe(true)

      const [miniBtn] = wrapper.findAll(".track-utils button")
      await miniBtn.trigger("click")
      await wrapper.vm.$nextTick()

      expect(window.api.restoreWindowSize).toHaveBeenCalledOnce()
      expect(wrapper.findComponent(Maximize2).exists()).toBe(true)
    })
  })

  describe("emits", () => {
    it("emits toggle-queue, toggle-immersive-mode, and open-equalizer", async () => {
      const wrapper = await mountBar()
      const [, queueBtn, immersiveBtn, eqBtn] = wrapper.findAll(".track-utils button")

      await queueBtn.trigger("click")
      expect(wrapper.emitted("toggle-queue")).toBeTruthy()

      await immersiveBtn.trigger("click")
      expect(wrapper.emitted("toggle-immersive-mode")).toBeTruthy()

      await eqBtn.trigger("click")
      expect(wrapper.emitted("open-equalizer")).toBeTruthy()
    })
  })

  describe("progress bar", () => {
    it("shows elapsed and remaining time labels", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      player.duration = 200
      player.currentTime = 50
      await wrapper.vm.$nextTick()

      expect(wrapper.find(".time-elapsed").text()).toBe("0:50")
      expect(wrapper.find(".time-remaining").text()).toBe("-2:30")
    })

    it("mousedown on the bar seeks and enters dragging state", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      const seekSpy = vi.spyOn(player, "seekTo")
      player.duration = 200
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        left: 0,
        width: 200,
      })

      const bar = wrapper.find(".progress-bar")
      await bar.trigger("mousedown", { clientX: 100 })

      expect(seekSpy).toHaveBeenCalledWith(100)
      expect(bar.classes()).toContain("dragging")
    })
  })

  describe("cover tint", () => {
    it("falls back to the default (no-tint) style when extractCoverColor resolves null", async () => {
      const wrapper = await mountBar()
      const bar = wrapper.find(".player-bar")
      expect(bar.attributes("style")).toContain("--cover-tint-opacity: 0")
    })
  })

  describe("lyrics toggle", () => {
    it("toggles player.showLyricsPanel and reflects the active state", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      const toggleSpy = vi.spyOn(player, "toggleLyricsPanel")
      const buttons = wrapper.findAll(".track-utils button")
      const lyricsBtn = buttons[buttons.length - 1]

      expect(lyricsBtn.classes()).not.toContain("active")
      await lyricsBtn.trigger("click")
      expect(toggleSpy).toHaveBeenCalledOnce()

      player.showLyricsPanel = true
      await wrapper.vm.$nextTick()
      expect(lyricsBtn.classes()).toContain("active")
    })
  })

  describe("shuffle/repeat", () => {
    it("toggling shuffle and repeat delegates to the player store", async () => {
      const wrapper = await mountBar()
      const player = usePlayerStore()
      const shuffleSpy = vi.spyOn(player, "toggleShuffle")
      const repeatSpy = vi.spyOn(player, "toggleRepeat")
      const [shuffleBtn, , , , repeatBtn] = wrapper.findAll(".controls button")

      await shuffleBtn.trigger("click")
      expect(shuffleSpy).toHaveBeenCalledOnce()

      await repeatBtn.trigger("click")
      expect(repeatSpy).toHaveBeenCalledOnce()
    })
  })
})
