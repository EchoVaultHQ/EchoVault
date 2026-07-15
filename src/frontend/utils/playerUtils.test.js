import { describe, it, expect, beforeEach, vi } from "vitest"
import { reactive, nextTick } from "vue"
import {
  formatTime,
  getStarStyle,
  useVolumeControl,
  getVolumeIcon,
  useProgressBar,
  usePlaybackControls,
  useQueueManagement,
  useTrackLike,
} from "./playerUtils.js"

function fakePlayer(overrides = {}) {
  return reactive({
    volume: 0.5,
    duration: 200,
    currentTrack: {},
    queue: [],
    shuffleEnabled: false,
    shuffleOrder: [],
    hasNext: false,
    hasPrevious: false,
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    seekTo: vi.fn(),
    togglePlay: vi.fn(async () => {}),
    playPrevious: vi.fn(async () => {}),
    playNext: vi.fn(async () => {}),
    playFromQueue: vi.fn(),
    setTrack: vi.fn(async () => {}),
    removeFromQueue: vi.fn(),
    notifyLikedChange: vi.fn(),
    ...overrides,
  })
}

function fakeBarEvent(clientX, { left = 0, width = 200 } = {}) {
  return {
    clientX,
    currentTarget: {
      getBoundingClientRect: () => ({ left, width }),
    },
  }
}

describe("formatTime", () => {
  it("formats seconds as m:ss with a zero-padded seconds portion", () => {
    expect(formatTime(65)).toBe("1:05")
  })

  it("returns 0:00 for falsy or NaN input", () => {
    expect(formatTime(0)).toBe("0:00")
    expect(formatTime(null)).toBe("0:00")
    expect(formatTime(NaN)).toBe("0:00")
  })

  it("truncates fractional seconds", () => {
    expect(formatTime(59.9)).toBe("0:59")
  })
})

describe("getStarStyle", () => {
  it("returns a style object with percentage/px/s units in range", () => {
    const style = getStarStyle(0)
    expect(style.left).toMatch(/^\d+(\.\d+)?%$/)
    expect(style.width).toMatch(/^\d+(\.\d+)?px$/)
    expect(style.height).toMatch(/^\d+(\.\d+)?px$/)
    expect(style.animationDuration).toMatch(/^\d+(\.\d+)?s$/)
    expect(style.animationDelay).toMatch(/^\d+(\.\d+)?s$/)
  })
})

describe("getVolumeIcon", () => {
  const icons = { Volume: "vol-icon", VolumeMute: "mute-icon" }

  it("returns the mute icon at zero volume", () => {
    expect(getVolumeIcon(0, icons)).toBe("mute-icon")
  })

  it("returns the normal icon for any nonzero volume", () => {
    expect(getVolumeIcon(42, icons)).toBe("vol-icon")
  })
})

describe("useVolumeControl", () => {
  it("initializes volume as a 0-100 scale derived from the player's 0-1 volume", () => {
    const player = fakePlayer({ volume: 0.42 })
    const { volume } = useVolumeControl(player)
    expect(volume.value).toBeCloseTo(42)
  })

  it("stays in sync when the underlying player volume changes externally", async () => {
    const player = fakePlayer({ volume: 0.2 })
    const { volume } = useVolumeControl(player)
    player.volume = 0.9
    await nextTick()
    expect(volume.value).toBeCloseTo(90)
  })

  it("onVolumeChange pushes the 0-100 slider value back as a 0-1 fraction", () => {
    const player = fakePlayer()
    const { volume, onVolumeChange } = useVolumeControl(player)
    volume.value = 75
    onVolumeChange()
    expect(player.setVolume).toHaveBeenCalledWith(0.75)
  })

  it("toggleMute delegates to the player", () => {
    const player = fakePlayer()
    const { toggleMute } = useVolumeControl(player)
    toggleMute()
    expect(player.toggleMute).toHaveBeenCalledOnce()
  })
})

describe("useProgressBar", () => {
  it("showHoverTime computes hover time/position from the pointer ratio", () => {
    const player = fakePlayer({ duration: 200 })
    const { hoverTime, hoverX, hoverTimeVisible, showHoverTime } = useProgressBar(player)
    showHoverTime(fakeBarEvent(50, { left: 0, width: 200 }))
    expect(hoverTime.value).toBeCloseTo(50) // 25% of 200s
    expect(hoverX.value).toBe(50)
    expect(hoverTimeVisible.value).toBe(true)
  })

  it("hideHoverTime hides the tooltip", () => {
    const player = fakePlayer()
    const { hoverTimeVisible, showHoverTime, hideHoverTime } = useProgressBar(player)
    showHoverTime(fakeBarEvent(10))
    hideHoverTime()
    expect(hoverTimeVisible.value).toBe(false)
  })

  it("seek clamps the ratio to [0,1] and calls player.seekTo with the target time", () => {
    const player = fakePlayer({ duration: 200 })
    const { seek } = useProgressBar(player)

    seek(fakeBarEvent(-50, { left: 0, width: 200 })) // ratio < 0
    expect(player.seekTo).toHaveBeenLastCalledWith(0)

    seek(fakeBarEvent(500, { left: 0, width: 200 })) // ratio > 1
    expect(player.seekTo).toHaveBeenLastCalledWith(200)

    seek(fakeBarEvent(100, { left: 0, width: 200 })) // ratio 0.5
    expect(player.seekTo).toHaveBeenLastCalledWith(100)
  })

  describe("drag-to-seek", () => {
    it("startDrag seeks immediately to the mousedown position and shows the tooltip", () => {
      const player = fakePlayer({ duration: 200 })
      const { isDragging, hoverTimeVisible, startDrag } = useProgressBar(player)

      startDrag(fakeBarEvent(100, { left: 0, width: 200 })) // ratio 0.5
      expect(player.seekTo).toHaveBeenLastCalledWith(100)
      expect(isDragging.value).toBe(true)
      expect(hoverTimeVisible.value).toBe(true)
    })

    it("moving the document-level mouse while dragging keeps seeking to the clamped ratio", () => {
      const player = fakePlayer({ duration: 200 })
      const { hoverTime, hoverX, startDrag } = useProgressBar(player)

      startDrag(fakeBarEvent(0, { left: 0, width: 200 }))
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 })) // ratio 0.75
      expect(player.seekTo).toHaveBeenLastCalledWith(150)
      expect(hoverTime.value).toBeCloseTo(150)
      expect(hoverX.value).toBeCloseTo(150)

      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 500 })) // clamps to 1
      expect(player.seekTo).toHaveBeenLastCalledWith(200)
    })

    it("mouseup stops dragging and hides the tooltip", () => {
      const player = fakePlayer({ duration: 200 })
      const { isDragging, hoverTimeVisible, startDrag } = useProgressBar(player)

      startDrag(fakeBarEvent(0, { left: 0, width: 200 }))
      document.dispatchEvent(new MouseEvent("mouseup"))

      expect(isDragging.value).toBe(false)
      expect(hoverTimeVisible.value).toBe(false)

      // further document mousemoves are ignored once the drag has ended
      player.seekTo.mockClear()
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 150 }))
      expect(player.seekTo).not.toHaveBeenCalled()
    })
  })
})

describe("usePlaybackControls", () => {
  it("togglePlay delegates to the player", async () => {
    const player = fakePlayer()
    const { togglePlay } = usePlaybackControls(player)
    await togglePlay()
    expect(player.togglePlay).toHaveBeenCalledOnce()
  })

  it("playPreviousTrack is a no-op when there is no previous track", async () => {
    const player = fakePlayer({ hasPrevious: false })
    const { playPreviousTrack } = usePlaybackControls(player)
    await playPreviousTrack()
    expect(player.playPrevious).not.toHaveBeenCalled()
  })

  it("playPreviousTrack calls through when a previous track exists", async () => {
    const player = fakePlayer({ hasPrevious: true })
    const { playPreviousTrack } = usePlaybackControls(player)
    await playPreviousTrack()
    expect(player.playPrevious).toHaveBeenCalledOnce()
  })

  it("playNextTrack is a no-op when there is no next track", async () => {
    const player = fakePlayer({ hasNext: false })
    const { playNextTrack } = usePlaybackControls(player)
    await playNextTrack()
    expect(player.playNext).not.toHaveBeenCalled()
  })

  it("playNextTrack calls through when a next track exists", async () => {
    const player = fakePlayer({ hasNext: true })
    const { playNextTrack } = usePlaybackControls(player)
    await playNextTrack()
    expect(player.playNext).toHaveBeenCalledOnce()
  })
})

describe("useQueueManagement", () => {
  it("displays the queue in normal order, rotated so the current track leads", () => {
    const player = fakePlayer({
      queue: [{ file_path: "a" }, { file_path: "b" }, { file_path: "c" }],
      currentTrack: { file_path: "b" },
    })
    const { displayedQueue } = useQueueManagement(player)
    expect(displayedQueue.value.map((t) => t.file_path)).toEqual(["b", "c", "a"])
  })

  it("does not rotate when the current track is already first", () => {
    const player = fakePlayer({
      queue: [{ file_path: "a" }, { file_path: "b" }],
      currentTrack: { file_path: "a" },
    })
    const { displayedQueue } = useQueueManagement(player)
    expect(displayedQueue.value.map((t) => t.file_path)).toEqual(["a", "b"])
  })

  it("resolves the shuffled order through shuffleOrder when shuffle is enabled", () => {
    const player = fakePlayer({
      queue: [{ file_path: "a" }, { file_path: "b" }, { file_path: "c" }],
      shuffleEnabled: true,
      shuffleOrder: [2, 0, 1],
      currentTrack: { file_path: "a" },
    })
    const { displayedQueue } = useQueueManagement(player)
    // base shuffled list is [c, a, b]; "a" is at index 1, so it rotates to lead
    expect(displayedQueue.value.map((t) => t.file_path)).toEqual(["a", "b", "c"])
  })

  it("returns an empty list unchanged", () => {
    const player = fakePlayer({ queue: [] })
    const { displayedQueue } = useQueueManagement(player)
    expect(displayedQueue.value).toEqual([])
  })

  it("playSongFromQueue resolves the queue position then plays without re-queueing", async () => {
    const player = fakePlayer()
    const { playSongFromQueue } = useQueueManagement(player)
    const t = { file_path: "b" }
    await playSongFromQueue(t)
    expect(player.playFromQueue).toHaveBeenCalledWith(t)
    expect(player.setTrack).toHaveBeenCalledWith(t, false)
  })

  it("removeFromQueue delegates to the player", () => {
    const player = fakePlayer()
    const { removeFromQueue } = useQueueManagement(player)
    const t = { file_path: "b" }
    removeFromQueue(t)
    expect(player.removeFromQueue).toHaveBeenCalledWith(t)
  })
})

describe("useTrackLike", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does nothing for a track without an id", async () => {
    const player = fakePlayer()
    const { toggleLikedSong } = useTrackLike(player)
    await toggleLikedSong({ title: "No id" })
    expect(window.api.toggleLike).not.toHaveBeenCalled()
  })

  it("likes an unliked track, persists it, and toasts success", async () => {
    const player = fakePlayer()
    const { toggleLikedSong } = useTrackLike(player)
    const t = { id: 1, title: "Song", isLiked: false }
    await toggleLikedSong(t)
    expect(t.isLiked).toBe(true)
    expect(window.api.toggleLike).toHaveBeenCalledWith(1, true)
    expect(player.notifyLikedChange).toHaveBeenCalledOnce()
    expect(window.api.showToast).toHaveBeenCalledWith(
      "Track Song has been added to your liked songs.",
      "success"
    )
  })

  it("unlikes a liked track and toasts the removal message", async () => {
    const player = fakePlayer()
    const { toggleLikedSong } = useTrackLike(player)
    const t = { id: 1, title: "Song", isLiked: true }
    await toggleLikedSong(t)
    expect(t.isLiked).toBe(false)
    expect(window.api.toggleLike).toHaveBeenCalledWith(1, false)
    expect(window.api.showToast).toHaveBeenCalledWith(
      "Track Song has been removed from your liked songs.",
      "success"
    )
  })

  it("defaults to the player's current track when no target is passed", async () => {
    const player = fakePlayer({ currentTrack: { id: 5, title: "Now Playing", isLiked: false } })
    const { toggleLikedSong } = useTrackLike(player)
    await toggleLikedSong()
    expect(window.api.toggleLike).toHaveBeenCalledWith(5, true)
  })

  it("keeps a separately-referenced currentTrack's isLiked in sync", async () => {
    const currentTrack = { id: 9, title: "Song", isLiked: false }
    const player = fakePlayer({ currentTrack })
    const { toggleLikedSong } = useTrackLike(player)
    const listRowCopy = { id: 9, title: "Song", isLiked: false }
    await toggleLikedSong(listRowCopy)
    expect(listRowCopy.isLiked).toBe(true)
    expect(currentTrack.isLiked).toBe(true)
  })
})
