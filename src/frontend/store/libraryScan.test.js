import { describe, it, expect, beforeEach, vi } from "vitest"
import { setActivePinia, createPinia } from "pinia"
import { useLibraryScanStore } from "./libraryScan.js"

describe("useLibraryScanStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.api.onLibraryScanProgress.mockImplementation(() => () => {})
  })

  it("starts idle", () => {
    const store = useLibraryScanStore()
    expect(store.progress).toBeNull()
    expect(store.isScanning).toBe(false)
  })

  describe("start", () => {
    it("wires the progress listener and enters a zeroed preparing state", () => {
      const store = useLibraryScanStore()
      store.start("add")
      expect(store.isScanning).toBe(true)
      expect(store.progress).toEqual({
        phase: "add",
        current: 0,
        total: 0,
        pct: 0,
        message: null,
        folderPath: null,
      })
      expect(window.api.onLibraryScanProgress).toHaveBeenCalledOnce()
    })

    it("applies incoming progress events to state", () => {
      let progressCallback
      window.api.onLibraryScanProgress.mockImplementation((cb) => {
        progressCallback = cb
        return () => {}
      })
      const store = useLibraryScanStore()
      store.start("add")
      progressCallback({ phase: "add", current: 3, total: 10, pct: 30, message: "song.flac", folderPath: "/music/a" })

      expect(store.progress).toEqual({
        phase: "add",
        current: 3,
        total: 10,
        pct: 30,
        message: "song.flac",
        folderPath: "/music/a",
      })
      expect(store.isFolderScanning("/music/a")).toBe(true)
      expect(store.isFolderScanning("/music/b")).toBe(false)
    })
  })

  describe("clear", () => {
    it("resets to idle", () => {
      const store = useLibraryScanStore()
      store.start("rescan")
      store.clear()
      expect(store.progress).toBeNull()
      expect(store.isScanning).toBe(false)
    })
  })
})
