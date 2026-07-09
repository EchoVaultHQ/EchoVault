import { ref, computed, watch } from "vue"

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
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
    if (volume.value === 0) {
      volume.value = player.volume * 100 || 50
    } else {
      volume.value = 0
    }
    player.setVolume(volume.value / 100)
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

  const showHoverTime = (event) => {
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    hoverTime.value = player.duration * ratio
    hoverX.value = event.clientX - rect.left
    hoverTimeVisible.value = true
  }

  const hideHoverTime = () => {
    hoverTimeVisible.value = false
  }

  const seek = (event) => {
    const bar = event.currentTarget
    const rect = bar.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    const targetTime = player.duration * Math.max(0, Math.min(1, ratio))
    player.seekTo(targetTime)
  }

  return {
    hoverTimeVisible,
    hoverTime,
    hoverX,
    showHoverTime,
    hideHoverTime,
    seek,
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

  const playSongFromQueue = async (track, index) => {
    if (player.shuffleEnabled && player.shuffleOrder?.length) {
      player.currentIndex = index // index in shuffled order
    } else {
      player.currentIndex = index
    }
    await player.setTrack(track, false)
  }

  const removeFromQueue = (index) => {
    player.queue.splice(index, 1)
  }

  return {
    displayedQueue,
    playSongFromQueue,
    removeFromQueue,
  }
}

// Like song
export function useTrackLike(player) {
  const toggleLikedSong = async () => {
    // notify listeners
    player.notifyLikedChange()

    const track = player.currentTrack
    if (!track?.id) return

    const newStatus = !track.isLiked

    // change the like status for UI
    track.isLiked = newStatus

    // send same to db
    await window.api.toggleLike(track.id, newStatus)

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
