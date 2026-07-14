import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { mountWithPlugins } from "../test-helpers.js"
import { usePlayerStore } from "../store/player.js"
import ImmersiveMode from "./ImmersiveMode.vue"

function stubRaf() {
  const queue = []
  vi.stubGlobal("requestAnimationFrame", (cb) => {
    queue.push(cb)
    return queue.length
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  return queue
}

function runOneTick(queue) {
  const cb = queue.shift()
  cb()
}

describe("ImmersiveMode.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it("shows the no-lyrics fallback when the track has no lyrics", () => {
    stubRaf()
    const wrapper = mountWithPlugins(ImmersiveMode)
    const player = usePlayerStore()
    player.lyrics = null
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find(".no-lyrics").exists()).toBe(true)
      expect(wrapper.find(".lyrics-scroll-area").exists()).toBe(false)
    })
  })

  describe("synchronized lyrics", () => {
    it("renders exactly one focused (dist-0) line matching the current timestamp window", async () => {
      const queue = stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      const player = usePlayerStore()
      player.lyrics = {
        text: "Line one\nLine two\nLine three",
        synchronized: true,
        timestamps: [
          { text: "Line one", startTime: 0, endTime: 10 },
          { text: "Line two", startTime: 10, endTime: 20 },
          { text: "Line three", startTime: 20, endTime: 30 },
        ],
      }
      player.currentTime = 12 // inside "Line two"'s window
      await wrapper.vm.$nextTick()
      runOneTick(queue)
      await wrapper.vm.$nextTick()

      const focused = wrapper.findAll(".lyric-line.dist-0")
      expect(focused).toHaveLength(1)
      expect(focused[0].text()).toBe("Line two")
    })

    it("advances the focused line as currentTime moves into the next window", async () => {
      const queue = stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      const player = usePlayerStore()
      player.lyrics = {
        text: "Line one\nLine two\nLine three",
        synchronized: true,
        timestamps: [
          { text: "Line one", startTime: 0, endTime: 10 },
          { text: "Line two", startTime: 10, endTime: 20 },
          { text: "Line three", startTime: 20, endTime: 30 },
        ],
      }
      player.currentTime = 12
      await wrapper.vm.$nextTick()
      runOneTick(queue)
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".lyric-line.dist-0").text()).toBe("Line two")

      player.currentTime = 22
      runOneTick(queue)
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".lyric-line.dist-0").text()).toBe("Line three")
    })

    it("resets the focused line back to none when the lyrics object changes", async () => {
      const queue = stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      const player = usePlayerStore()
      player.lyrics = {
        text: "Line one\nLine two",
        synchronized: true,
        timestamps: [
          { text: "Line one", startTime: 0, endTime: 10 },
          { text: "Line two", startTime: 10, endTime: 20 },
        ],
      }
      player.currentTime = 12
      await wrapper.vm.$nextTick()
      runOneTick(queue)
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".lyric-line.dist-0").exists()).toBe(true)

      player.lyrics = {
        text: "New song",
        synchronized: true,
        timestamps: [{ text: "New song", startTime: 0, endTime: 10 }],
      }
      await wrapper.vm.$nextTick()
      expect(wrapper.find(".lyric-line.dist-0").text()).toBe("")
    })
  })

  it("renders the plain-lines branch for non-synchronized lyrics, skipping blank lines", async () => {
    stubRaf()
    const wrapper = mountWithPlugins(ImmersiveMode)
    const player = usePlayerStore()
    player.lyrics = { text: "First line\n\nSecond line", synchronized: false }
    await wrapper.vm.$nextTick()

    const plainLines = wrapper.findAll(".lyric-line.plain")
    expect(plainLines.map((n) => n.text())).toEqual(["First line", "Second line"])
  })

  describe("keyboard handling", () => {
    it("Escape emits close-immersive-mode", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      expect(wrapper.emitted("close-immersive-mode")).toBeTruthy()
    })

    it("other keys do nothing", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
      expect(wrapper.emitted("close-immersive-mode")).toBeFalsy()
    })

    it("removes the keydown listener and cancels the rAF loop on unmount", () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      wrapper.unmount()
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
      expect(wrapper.emitted("close-immersive-mode")).toBeFalsy()
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })
  })

  describe("more menu", () => {
    it("toggles the more menu open/closed", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      await wrapper.find(".more-wrap button").trigger("click")
      expect(wrapper.find(".more-menu").exists()).toBe(true)
      await wrapper.find(".more-wrap button").trigger("click")
      expect(wrapper.find(".more-menu").exists()).toBe(false)
    })

    it("shows the like label when unliked, and calls toggleLikedSong + closes the menu on click", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      const player = usePlayerStore()
      player.currentTrack = { id: 1, title: "Song", isLiked: false }
      await wrapper.vm.$nextTick()

      await wrapper.find(".more-wrap button").trigger("click")
      const likeItem = wrapper.findAll(".more-menu-item")[0]
      expect(likeItem.text()).toContain("Like")

      await likeItem.trigger("click")
      expect(window.api.toggleLike).toHaveBeenCalledWith(1, true)
      expect(wrapper.find(".more-menu").exists()).toBe(false)
    })

    it("shows the unlike label when the track is already liked", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      const player = usePlayerStore()
      player.currentTrack = { id: 1, title: "Song", isLiked: true }
      await wrapper.vm.$nextTick()

      await wrapper.find(".more-wrap button").trigger("click")
      expect(wrapper.findAll(".more-menu-item")[0].text()).toContain("Unlike")
    })
  })

  describe("emits", () => {
    it("emits toggle-queue and open-equalizer", async () => {
      stubRaf()
      const wrapper = mountWithPlugins(ImmersiveMode)
      await wrapper.find(".track-utils > button").trigger("click")
      expect(wrapper.emitted("toggle-queue")).toBeTruthy()

      await wrapper.find(".top-right-cluster button").trigger("click")
      expect(wrapper.emitted("open-equalizer")).toBeTruthy()
    })
  })
})
