import "../store/player.audio-mocks.js"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { mountWithPlugins } from "../test-helpers.js"
import { usePlayerStore } from "../store/player.js"
import LyricsPanel from "./LyricsPanel.vue"

function stubRaf() {
  vi.stubGlobal("requestAnimationFrame", () => 1)
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
}

describe("LyricsPanel.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    stubRaf()
  })

  it("renders nothing when showLyricsPanel is false", () => {
    const wrapper = mountWithPlugins(LyricsPanel)
    const player = usePlayerStore()
    player.showLyricsPanel = false
    expect(wrapper.find(".lyrics-panel").exists()).toBe(false)
  })

  it("clicking the close button toggles showLyricsPanel off", async () => {
    const wrapper = mountWithPlugins(LyricsPanel)
    const player = usePlayerStore()
    player.showLyricsPanel = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find(".lyrics-panel").exists()).toBe(true)
    await wrapper.find(".lyrics-close-btn").trigger("click")
    expect(player.showLyricsPanel).toBe(false)
  })
})
