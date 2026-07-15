import { ref, computed, watch, onMounted, onUnmounted } from "vue"

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatTotalDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Volume Control
export function useVolumeControl(player) {
  // Derived from the shared store, not a per-component default, so normal
  // and immersive mode (separate calls to this composable) stay in sync.
  const volume = ref(player.volume * 100)

  watch(
    () => player.volume,
    (v) => {
      volume.value = v * 100
    }
  )

  const onVolumeChange = () => {
    player.setVolume(volume.value / 100)
  }

  const toggleMute = () => {
    player.toggleMute()
  }

  return {
    volume,
    onVolumeChange,
    toggleMute,
  }
}

export function getVolumeIcon(volumeValue, icons) {
  return volumeValue === 0 ? icons.VolumeMute : icons.Volume
}

// Progress Bar
export function useProgressBar(player) {
  const hoverTimeVisible = ref(false)
  const hoverTime = ref(0)
  const hoverX = ref(0)
  const isDragging = ref(false)
  let dragRect = null

  const showHoverTime = (event) => {
    if (isDragging.value) return
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    hoverTime.value = player.duration * ratio
    hoverX.value = event.clientX - rect.left
    hoverTimeVisible.value = true
  }

  const hideHoverTime = () => {
    if (isDragging.value) return
    hoverTimeVisible.value = false
  }

  const seek = (event) => {
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const targetTime = player.duration * Math.max(0, Math.min(1, ratio))
    player.seekTo(targetTime)
  }

  // Shared by drag-move — clamps to the bar's own rect captured at drag
  // start, since mousemove targets whatever element the cursor is over,
  // not necessarily the bar.
  const seekToClientX = (clientX, rect) => {
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    player.seekTo(player.duration * ratio)
    return ratio
  }

  const onDragMove = (event) => {
    if (!dragRect) return
    const ratio = seekToClientX(event.clientX, dragRect)
    hoverX.value = ratio * dragRect.width
    hoverTime.value = player.duration * ratio
  }

  const stopDrag = () => {
    isDragging.value = false
    hoverTimeVisible.value = false
    dragRect = null
    document.removeEventListener("mousemove", onDragMove)
    document.removeEventListener("mouseup", stopDrag)
  }

  // mousedown covers both a plain click-to-seek (mousedown+mouseup with no
  // movement already seeks) and a full drag.
  const startDrag = (event) => {
    dragRect = event.currentTarget.getBoundingClientRect()
    isDragging.value = true
    hoverTimeVisible.value = true
    onDragMove(event)
    document.addEventListener("mousemove", onDragMove)
    document.addEventListener("mouseup", stopDrag)
  }

  return {
    hoverTimeVisible,
    hoverTime,
    hoverX,
    isDragging,
    showHoverTime,
    hideHoverTime,
    seek,
    startDrag,
  }
}

// Playback Controls
export function usePlaybackControls(player) {
  const togglePlay = async () => {
    await player.togglePlay()
  }

  const playPreviousTrack = async () => {
    if (!player.hasPrevious) return
    await player.playPrevious()
  }

  const playNextTrack = async () => {
    if (!player.hasNext) return
    await player.playNext()
  }

  return {
    togglePlay,
    playPreviousTrack,
    playNextTrack,
  }
}

// Queue Management
export function useQueueManagement(player) {
  const displayedQueue = computed(() => {
    // shuffled / normal
    const baseList =
      player.shuffleEnabled && player.shuffleOrder?.length
        ? player.shuffleOrder.map((i) => player.queue[i])
        : player.queue

    if (!baseList.length) return baseList

    // get currently playing track in displayed list
    const currentIndex = baseList.findIndex(
      (t) => t.file_path === player.currentTrack?.file_path
    )

    if (currentIndex <= 0) return baseList

    //current track is always at top
    return [...baseList.slice(currentIndex), ...baseList.slice(0, currentIndex)]
  })

  const playSongFromQueue = async (track) => {
    // Identify by track, not the sidebar's rotated display index, since
    // that index doesn't map 1:1 onto player.queue/shuffleOrder.
    player.playFromQueue(track)
    await player.setTrack(track, false)
  }

  const removeFromQueue = (track) => {
    player.removeFromQueue(track)
  }

  return {
    displayedQueue,
    playSongFromQueue,
    removeFromQueue,
  }
}

// Lyrics sync — shared by ImmersiveMode and LyricsPanel so both stay
// identical without duplicating the rAF-driven active-line tracking.
export function useLyricsSync(player, windowRadius = 3) {
  const hasLyrics = computed(() => !!player.lyrics?.text)
  const plainLyricLines = computed(() =>
    (player.lyrics?.text || "").split("\n").filter((line) => line.trim())
  )

  // Active line is driven by the actual playback clock (player.getLiveTime(),
  // backed by the Web Audio context — there is no <audio> element in this app)
  // via requestAnimationFrame, not setInterval. The index is only written when
  // it actually changes, so Vue doesn't re-render on every frame.
  const activeIndex = ref(-1)
  let rafHandle = null

  function tickLyricSync() {
    const timestamps = player.lyrics?.timestamps
    if (timestamps?.length) {
      const t = player.getLiveTime()
      const idx = timestamps.findIndex(
        (line) => t >= line.startTime && t < line.endTime
      )
      if (idx !== activeIndex.value) activeIndex.value = idx
    }
    rafHandle = requestAnimationFrame(tickLyricSync)
  }

  onMounted(() => {
    rafHandle = requestAnimationFrame(tickLyricSync)
  })

  onUnmounted(() => {
    if (rafHandle) cancelAnimationFrame(rafHandle)
  })

  watch(
    () => player.lyrics,
    () => {
      activeIndex.value = -1
    }
  )

  // Render only ±windowRadius lines around the active one (never the whole
  // list) so a long lyric file doesn't mean hundreds of DOM nodes.
  const visibleWindow = computed(() => {
    const timestamps = player.lyrics?.timestamps
    const active = activeIndex.value
    const slots = []
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const realIdx = active + offset
      const line = timestamps?.[realIdx]
      slots.push({
        key: line ? `line-${realIdx}` : `pad-${offset}`,
        line,
        distance: Math.abs(offset),
      })
    }
    return slots
  })

  return { hasLyrics, plainLyricLines, visibleWindow }
}

// Like song
export function useTrackLike(player) {
  // Defaults to the currently-playing track, but accepts any track object
  // (e.g. a row in a track list) so liking doesn't require playback first.
  const toggleLikedSong = async (targetTrack) => {
    const track = targetTrack ?? player.currentTrack
    if (!track?.id) return

    const newStatus = !track.isLiked

    // change the like status for UI
    track.isLiked = newStatus

    // keep the now-playing heart in sync if it's a separate object for the same track
    if (
      player.currentTrack &&
      player.currentTrack !== track &&
      player.currentTrack.id === track.id
    ) {
      player.currentTrack.isLiked = newStatus
    }

    // send same to db
    await window.api.toggleLike(track.id, newStatus)

    // notify listeners so other open views resync isLiked
    player.notifyLikedChange()

    // based on status, show toast

    if (newStatus) {
      window.api.showToast?.(
        `Track ${track.title} has been added to your liked songs.`,
        "success"
      )
    } else {
      window.api.showToast?.(
        `Track ${track.title} has been removed from your liked songs.`,
        "success"
      )
    }
  }

  return { toggleLikedSong }
}

// Generate stars
export function getStarStyle(index) {
  const left = Math.random() * 100
  const animationDuration = 2 + Math.random() * 4 // 2-6 seconds
  const animationDelay = Math.random() * 5 // 0-5 seconds delay
  const size = 1 + Math.random() * 2 // 1-3px star size

  return {
    left: `${left}%`,
    animationDuration: `${animationDuration}s`,
    animationDelay: `${animationDelay}s`,
    width: `${size}px`,
    height: `${size}px`,
  }
}
