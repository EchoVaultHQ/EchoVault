import { defineStore } from "pinia"

let currentSource = null
let currentAudioBuffer = null // Track the buffer
let _playStartTime = 0
const audioCtx = new AudioContext({ sampleRate: 48000 })
const gainNode = audioCtx.createGain() // master gain for volume
gainNode.connect(audioCtx.destination)

export const usePlayerStore = defineStore("player", {
  state: () => ({
    currentTrack: {},
    isPlaying: false,
    lyrics: null,
    cacheStats: {
      hits: 0,
      misses: 0,
    },
    queue: [], // Track queue
    currentIndex: 0, // curr track index in queue
    volume: 0.5, // 0 - 1 , default 0.5
    likedUpdated: 0,
    repeatMode: "off", // 'off', 'all', 'one'
    shuffleEnabled: false,
    playHistory: [], // For  shuffle
    queueSource: "all", // 'all', 'artist', 'liked'
    progress: 0, // 0–1 normalized progress
    duration: 0, // total duration in seconds
    currentTime: 0, // current playback position
    shuffleOrder: [], // shuffled indices
    originalOrder: [], // original order for restoring
  }),
  getters: {
    hasNext: (state) => state.currentIndex < state.queue.length - 1,
    hasPrevious: (state) => state.currentIndex > 0,
    queueLength: (state) => state.queue.length,
  },
  actions: {
    async setTrack(track, addToQueue = true) {
      const clonedTrack = { ...track } // Make a copy
      this.currentTrack = clonedTrack
      this.lyrics = null // Reset lyrics
      this.getLyrics() // Fire-and-forget, don't block playback start
      this.isPlaying = true

      // Add to queue
      if (addToQueue) {
        const existingIndex = this.queue.findIndex(
          (t) => t.file_path === track.file_path
        )

        if (existingIndex === -1) {
          // add it
          this.queue.push({ ...track })
          this.currentIndex = this.queue.length - 1
        } else {
          // just update index
          this.currentIndex = existingIndex
        }
      }

      // Play track
      await this.playTrack(track.file_path)

      // Increment play count
      if (track.id) {
        try {
          await window.api.incrementPlayCount(track.id)
          window.api.info(`Play count incremented for: ${track.title}`)
        } catch (err) {
          console.warn("Failed to increment play count:", err)
        }
      }
    },

    async playTrack(filePath) {
      // CRITICAL: Stop and clear previous track FIRST
      if (currentSource) {
        window.api.info("Stopping previous track")
        try {
          currentSource.onended = null
          currentSource.stop()
          currentSource.disconnect()
          currentSource.buffer = null
        } catch (e) {
          // Already stopped
        }
        currentSource = null
      }

      // Clear old buffer BEFORE loading new one
      if (currentAudioBuffer) {
        window.api.info("Clearing previous AudioBuffer")
        currentAudioBuffer = null
      }

      try {
        window.api.info("Playing track:", filePath)

        let audioBuffer

        // Get file size
        const fileSize = await window.api.getFileSize(filePath)
        window.api.info("File size:", fileSize, "bytes")

        // Stream file in chunks
        const chunkSize = fileSize > 10 * 1024 * 1024 ? 512 * 1024 : 256 * 1024
        const chunks = []
        let offset = 0

        while (offset < fileSize) {
          const size = Math.min(chunkSize, fileSize - offset)
          const chunk = await window.api.streamChunk(filePath, offset, size)
          chunks.push(chunk)
          offset += size
        }

        // Combine chunks
        const totalLength = chunks.reduce(
          (acc, chunk) => acc + chunk.byteLength,
          0
        )
        const combinedBuffer = new ArrayBuffer(totalLength)
        const combinedView = new Uint8Array(combinedBuffer)

        let position = 0
        for (const chunk of chunks) {
          combinedView.set(new Uint8Array(chunk), position)
          position += chunk.byteLength
        }

        // Decode audio
        window.api.info("Decoding audio buffer...")
        audioBuffer = await audioCtx.decodeAudioData(combinedBuffer)

        // Store buffer reference for memory tracking
        currentAudioBuffer = audioBuffer

        // Stop previous track if playing
        if (currentSource) {
          window.api.info("Stopping previous track")
          try {
            // prevent auto-triggering of onended during manual stop
            currentSource.onended = null

            currentSource.stop()
            currentSource.disconnect()
          } catch (e) {
            // Already stopped, ignore
          }
        }

        // Play new track
        const source = audioCtx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(gainNode)
        source.start(0)
        _playStartTime = audioCtx.currentTime // reset reference point
        this.currentTime = 0
        this.progress = 0
        this.duration = audioBuffer.duration
        this.startProgressUpdater()

        currentSource = source
        this.isPlaying = true

        // Handle track end
        source.onended = () => {
          window.api.info("Track ended")

          // Try to play next track
          const hasNext = this.playNext()

          // Only set to false if no next track
          if (!hasNext) {
            this.isPlaying = false
            window.api.info("Queue finished")
          }
        }
      } catch (err) {
        console.error("Error playing track:", err)
        console.error("Error playing track:", err)

        // error toast
        window.api.showToast?.(
          `Track "${this.currentTrack?.title || "Unknown"}" can't be played — unsupported or corrupted format.`,
          "error"
        )

        // next track automatically
        const hasNext = await this.playNext()
        if (!hasNext) {
          this.isPlaying = false
          window.api.info("No playable tracks left in queue.")
        }
      }
    },

    async playPrevious() {
      if (this.progressTimer) clearInterval(this.progressTimer)
      this.currentTime = 0
      this.progress = 0
      _playStartTime = audioCtx.currentTime

      const order = this.shuffleEnabled
        ? this.shuffleOrder
        : this.originalOrder.length
          ? this.originalOrder
          : null

      if (this.shuffleEnabled && order?.length) {
        const prevIndexInOrder = this.currentIndex - 1

        if (prevIndexInOrder >= 0) {
          this.currentIndex = prevIndexInOrder
          const prevTrack = this.queue[order[prevIndexInOrder]]
          await this.setTrack(prevTrack, false)
          return true
        }
      } else if (this.hasPrevious) {
        this.currentIndex--
        await this.setTrack(this.queue[this.currentIndex], false)
        return true
      }

      window.api.info("No previous track")
      return false
    },

    async playNext() {
      if (this.progressTimer) clearInterval(this.progressTimer)
      this.currentTime = 0
      this.progress = 0
      _playStartTime = audioCtx.currentTime

      const order = this.shuffleEnabled
        ? this.shuffleOrder
        : this.originalOrder.length
          ? this.originalOrder
          : null

      if (this.shuffleEnabled && order?.length) {
        const currentRealIndex = order[this.currentIndex]
        const nextIndexInOrder = this.currentIndex + 1

        if (nextIndexInOrder < order.length) {
          this.currentIndex = nextIndexInOrder
          const nextTrack = this.queue[order[nextIndexInOrder]]
          await this.setTrack(nextTrack, false)
          return true
        }
      } else if (this.hasNext) {
        this.currentIndex++
        await this.setTrack(this.queue[this.currentIndex], false)
        return true
      }

      window.api.info("No next track")
      return false
    },

    // Clear queue
    clearQueue() {
      if (this.progressTimer) clearInterval(this.progressTimer)

      this.queue = []
      this.currentIndex = 0
    },

    // Remove track from queue
    removeFromQueue(index) {
      if (index < 0 || index >= this.queue.length) return

      this.queue.splice(index, 1)

      // Adjust current index if needed
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = this.queue.length - 1
      } else if (index < this.currentIndex) {
        this.currentIndex--
      }
    },

    async togglePlay() {
      if (!this.currentTrack?.file_path) return

      // play - pause
      if (this.isPlaying) {
        await audioCtx.suspend()
        this.isPlaying = false
        return
      }

      // pause - play
      if (audioCtx.state === "suspended" && currentSource) {
        await audioCtx.resume()
        this.isPlaying = true
        return
      }

      // play new track
      if (!currentSource) {
        await this.playTrack(this.currentTrack.file_path)
        this.isPlaying = true
      }
    },

    setVolume(level) {
      this.volume = Math.max(0, Math.min(level, 1))
      gainNode.gain.setTargetAtTime(this.volume, audioCtx.currentTime, 0.01)
    },

    async getLyrics() {
      if (!this.currentTrack?.file_path) {
        return
      }

      const filePath = this.currentTrack.file_path
      const fetchOnline = localStorage.getItem("fetchLyricsOnline") !== "false"

      try {
        const lyrics = await window.api.getLyrics(filePath, { fetchOnline })
        if (lyrics?.text) {
          console.log(
            `[lyrics] found via "${lyrics.source}" (synced: ${lyrics.synchronized}) for ${filePath}`
          )
        } else {
          const reasonSuffix = lyrics?.reason ? ` (reason: ${lyrics.reason})` : ""
          console.log(`[lyrics] no lyrics found for ${filePath}${reasonSuffix}`)
        }
        // Track may have changed again while this was in flight
        if (this.currentTrack.file_path === filePath) {
          this.lyrics = lyrics
        }
      } catch (err) {
        console.error("Failed to read lyrics:", err)
        if (this.currentTrack.file_path === filePath) {
          this.lyrics = null
        }
      }
    },

    // Play entire queue starting from index
    async playQueue(tracks, startIndex = 0) {
      if (!tracks || tracks.length === 0) return

      this.queue = [...tracks]
      this.currentIndex = startIndex
      await this.setTrack(this.queue[startIndex], false) // false = don't re-add to queue
    },

    notifyLikedChange() {
      this.likedUpdated++
    },

    toggleShuffle() {
      this.shuffleEnabled = !this.shuffleEnabled

      if (this.shuffleEnabled) {
        window.api.info("Shuffle enabled")

        // Build an array of indices [0, 1, 2, ...]
        this.originalOrder = [...Array(this.queue.length).keys()]

        // Fisher-Yates shuffle for true randomness
        this.shuffleOrder = this.originalOrder
          .slice()
          .sort(() => Math.random() - 0.5)

        // Find current track’s new position
        const currentFile = this.currentTrack?.file_path
        const currentIndexInOriginal = this.queue.findIndex(
          (t) => t.file_path === currentFile
        )
        const newPos = this.shuffleOrder.indexOf(currentIndexInOriginal)
        this.currentIndex = newPos >= 0 ? newPos : 0
      } else {
        window.api.info("Shuffle disabled")

        // Restore original order
        const currentFile = this.currentTrack?.file_path
        const currentIndexInOriginal = this.queue.findIndex(
          (t) => t.file_path === currentFile
        )
        this.shuffleOrder = []
        this.currentIndex =
          currentIndexInOriginal >= 0 ? currentIndexInOriginal : 0
      }
    },

    toggleRepeat() {
      // Cycle: off -> all -> one -> off
      const modes = ["off", "all", "one"]
      const currentIdx = modes.indexOf(this.repeatMode)
      this.repeatMode = modes[(currentIdx + 1) % modes.length]
      window.api.info("Repeat mode:", this.repeatMode)
    },

    checkAudioMemory() {
      window.api.info("=== Audio Memory Check ===")

      // Check AudioContext state
      window.api.info("AudioContext state:", audioCtx.state)
      window.api.info("AudioContext sample rate:", audioCtx.sampleRate)
      window.api.info(
        "AudioContext current time:",
        audioCtx.currentTime.toFixed(2),
        "s"
      )

      // Check if source exists
      window.api.info("Current source exists:", !!currentSource)
      window.api.info("Current buffer exists:", !!currentAudioBuffer)

      // Estimate buffer size if exists
      if (currentAudioBuffer) {
        const channels = currentAudioBuffer.numberOfChannels
        const length = currentAudioBuffer.length
        const sampleRate = currentAudioBuffer.sampleRate
        const duration = currentAudioBuffer.duration

        // Each sample is 4 bytes (32-bit float)
        const sizeInBytes = channels * length * 4
        const sizeInMB = Math.round(sizeInBytes / 1024 / 1024)

        window.api.info("AudioBuffer details:")
        window.api.info("  Channels:", channels)
        window.api.info("  Length:", length.toLocaleString(), "samples")
        window.api.info("  Sample rate:", sampleRate, "Hz")
        window.api.info("  Duration:", Math.round(duration), "seconds")
        window.api.info("  Estimated size:", sizeInMB, "MB")
      }

      // Check performance memory
      if (performance.memory) {
        window.api.info("Performance memory:")
        window.api.info(
          "  JS Heap Used:",
          Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          "MB"
        )
        window.api.info(
          "  JS Heap Total:",
          Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          "MB"
        )
        window.api.info(
          "  JS Heap Limit:",
          Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
          "MB"
        )
      }

      window.api.info("======================")
    },

    // Frame-accurate playback position, independent of the 200ms progress-bar
    // interval — used for lyric sync, which needs finer-grained updates.
    getLiveTime() {
      if (!this.isPlaying || !currentSource || !currentAudioBuffer) {
        return this.currentTime
      }
      return Math.min(
        audioCtx.currentTime - _playStartTime,
        currentAudioBuffer.duration
      )
    },

    startProgressUpdater() {
      if (this.progressTimer) clearInterval(this.progressTimer)

      this.progressTimer = setInterval(() => {
        if (this.isPlaying && currentSource && currentAudioBuffer) {
          const elapsed = audioCtx.currentTime - _playStartTime
          this.currentTime = Math.min(elapsed, currentAudioBuffer.duration)
          this.duration = currentAudioBuffer.duration
          this.progress = Math.min(this.currentTime / this.duration, 1)
        }
      }, 200)
    },

    async seekTo(targetTime) {
      if (!this.currentTrack?.file_path) return
      if (!currentAudioBuffer) return

      // seek time
      const t = Math.max(0, Math.min(targetTime, currentAudioBuffer.duration))

      try {
        if (currentSource) {
          currentSource.onended = null
          currentSource.stop()
          currentSource.disconnect()
        }

        const src = audioCtx.createBufferSource()
        src.buffer = currentAudioBuffer
        src.connect(gainNode)
        src.start(0, t)

        currentSource = src
        this.isPlaying = true
        this.currentTime = t
        this.duration = currentAudioBuffer.duration
        this.progress = t / this.duration
        _playStartTime = audioCtx.currentTime - t

        // restart progress tracking
        this.startProgressUpdater()

        src.onended = () => {
          const hasNext = this.playNext()
          if (!hasNext) this.isPlaying = false
        }
      } catch (e) {
        console.error("Seek error:", e)
      }
    },
  },
})
