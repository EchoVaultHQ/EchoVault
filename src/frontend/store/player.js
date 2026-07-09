import { defineStore } from "pinia"
import { EQ_BANDS, EQ_PRESETS } from "../utils/eqPresets.js"

// No forced sampleRate: matches the output device's native rate instead of
// always resampling to a fixed 48kHz regardless of the device or source file.
const audioCtx = new AudioContext()
const gainNode = audioCtx.createGain() // master gain for volume
gainNode.connect(audioCtx.destination)

// Pre-gain stage for loudness normalization, applied before EQ so the tone
// curve never skews the loudness estimate. Unity (1.0) when disabled.
const normalizationGain = audioCtx.createGain()

// Persistent 10-band graphic EQ. Created once and reused across tracks like
// gainNode above (AudioNodes other than sources aren't single-use).
const eqFilters = EQ_BANDS.map((freq) => {
  const filter = audioCtx.createBiquadFilter()
  filter.type = "peaking"
  filter.frequency.value = freq
  filter.Q.value = 1.4
  filter.gain.value = 0
  return filter
})

// Chain: audioEl -> normalizationGain -> eq[0] -> ... -> eq[9] -> gainNode -> destination
eqFilters.reduce((prev, node) => {
  prev.connect(node)
  return node
}, normalizationGain)
eqFilters[eqFilters.length - 1].connect(gainNode)

// Streamed playback: a single persistent <audio> element (never recreated,
// same pattern as gainNode/eqFilters above) whose src is swapped per track.
// Replaces the old whole-file IPC-read + decodeAudioData() approach, so a
// track no longer needs to be fully downloaded/decoded into memory before
// playback can start. createMediaElementSource can only be called once per
// element, which is exactly why it's created once here rather than per-track.
const audioEl = new Audio()
audioEl.crossOrigin = "anonymous" // pairs with the corsEnabled custom protocol, so AnalyserNode reads below aren't blocked as "tainted"
const mediaSource = audioCtx.createMediaElementSource(audioEl)
mediaSource.connect(normalizationGain)

// Parallel analysis tap for live loudness normalization — doesn't affect the
// audible signal chain above, just reads from it.
const normalizerAnalyser = audioCtx.createAnalyser()
normalizerAnalyser.fftSize = 2048
mediaSource.connect(normalizerAnalyser)

function toStreamUrl(filePath) {
  // Fixed "local" host + encoded path in the URL's path component. This
  // scheme is registered "standard", so a bare "echovault-audio://<encoded>"
  // would put the encoded path where the HOST goes and get mangled by host
  // canonicalization - a real, non-empty host segment sidesteps that
  // entirely (and empty-host handling varies between the legacy
  // registerBufferProtocol API and the modern protocol.handle API).
  return `echovault-audio://local/${encodeURIComponent(filePath)}`
}

function readPersistedBands() {
  try {
    const raw = localStorage.getItem("eqBands")
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === EQ_BANDS.length) {
      return parsed
    }
    return null
  } catch (e) {
    console.warn("Failed to parse persisted eqBands, using defaults:", e)
    return null
  }
}

const initialEqEnabled = localStorage.getItem("eqEnabled") !== "false" // default true
const initialEqPreset = localStorage.getItem("eqPreset") || "Flat"
const initialEqBands = readPersistedBands() || EQ_PRESETS.Flat.slice()
const initialNormalizationEnabled =
  localStorage.getItem("normalizationEnabled") === "true" // default false

// Apply persisted gains to the real nodes before first playback.
eqFilters.forEach((filter, i) => {
  filter.gain.value = initialEqEnabled ? initialEqBands[i] : 0
})

// Output device selection, via the Audio Output Devices API
// (AudioContext.setSinkId) — a direct Chromium/Web Audio feature, no manual
// MediaStreamAudioDestinationNode/hidden-<audio> routing needed. "" means
// the system default device.
const initialOutputDeviceId = localStorage.getItem("outputDeviceId") || ""
if (initialOutputDeviceId && typeof audioCtx.setSinkId === "function") {
  audioCtx.setSinkId(initialOutputDeviceId).catch((err) => {
    console.warn("Saved output device unavailable, using default:", err)
  })
}

// Live-adaptive loudness normalization (NOT true LUFS/EBU R128, and not a
// continuous compressor/leveler either): the analyser is sampled for a short
// window at the start of each track, one RMS-based gain is computed from
// that window, then held steady for the rest of the track — matching
// "normalize per track" semantics without needing the whole file decoded
// upfront. Upgrade path: replace with a proper ITU-R BS.1770 K-weighted
// loudness meter if perceptual accuracy becomes a requirement.
const TARGET_RMS_DBFS = -18
const NORMALIZATION_MEASURE_WINDOW_SEC = 1.5
let normMeasureSumSquares = 0
let normMeasureCount = 0
let normMeasureStartTime = 0
let normSettled = true
const normSampleBuffer = new Float32Array(normalizerAnalyser.fftSize)

function gainDbFromRms(rms) {
  if (rms <= 0 || !isFinite(rms)) return 0 // silent/degenerate signal: no boost
  const measuredDb = 20 * Math.log10(rms)
  const gainDb = TARGET_RMS_DBFS - measuredDb
  return Math.max(-12, Math.min(12, gainDb))
}

function resetNormalizationMeasurement() {
  normMeasureSumSquares = 0
  normMeasureCount = 0
  normMeasureStartTime = audioCtx.currentTime
  normSettled = false
}

function tickNormalizationMeasurement(normalizationEnabled) {
  if (!normalizationEnabled || normSettled) return

  normalizerAnalyser.getFloatTimeDomainData(normSampleBuffer)
  for (let i = 0; i < normSampleBuffer.length; i++) {
    const s = normSampleBuffer[i]
    normMeasureSumSquares += s * s
  }
  normMeasureCount += normSampleBuffer.length

  const elapsed = audioCtx.currentTime - normMeasureStartTime
  if (elapsed < NORMALIZATION_MEASURE_WINDOW_SEC || normMeasureCount === 0) return

  const rms = Math.sqrt(normMeasureSumSquares / normMeasureCount)
  const linear = Math.pow(10, gainDbFromRms(rms) / 20)
  normalizationGain.gain.setTargetAtTime(linear, audioCtx.currentTime, 0.3)
  normSettled = true
}

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
    scrobbleSent: false, // whether the current play has already been scrobbled to Last.fm
    shuffleOrder: [], // shuffled indices
    originalOrder: [], // original order for restoring
    eqEnabled: initialEqEnabled,
    eqPreset: initialEqPreset, // preset name, or "Custom"
    eqBands: initialEqBands, // 10 dB values, -12..12, aligned to EQ_BANDS
    normalizationEnabled: initialNormalizationEnabled,
    outputDeviceId: initialOutputDeviceId, // '' = system default
    outputDevices: [], // populated at runtime via refreshOutputDevices()
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
      this.scrobbleSent = false
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

      // Last.fm now-playing update (fire-and-forget, no-op if not connected)
      if (track.artist && track.title) {
        window.api.lastfmNowPlaying({
          artist: track.artist,
          title: track.title,
          album: track.album,
          duration: track.duration,
        })
      }

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
      try {
        window.api.info("Playing track:", filePath)

        audioEl.pause()
        audioEl.src = toStreamUrl(filePath)
        audioEl.load()

        resetNormalizationMeasurement()
        if (!this.normalizationEnabled) {
          normalizationGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.01)
        }

        if (audioCtx.state === "suspended") await audioCtx.resume()
        await audioEl.play()

        this.currentTime = 0
        this.progress = 0
        this.duration = isFinite(audioEl.duration) ? audioEl.duration : 0
        this.startProgressUpdater()
        this.isPlaying = true

        // Handle track end
        audioEl.onended = async () => {
          window.api.info("Track ended")

          if (this.repeatMode === "one") {
            audioEl.currentTime = 0
            await audioEl.play()
            return
          }

          let hasNext = await this.playNext()

          // Repeat-all: wrap back to the start of the queue instead of stopping
          if (!hasNext && this.repeatMode === "all" && this.queue.length > 0) {
            const order = this.shuffleEnabled ? this.shuffleOrder : null
            this.currentIndex = 0
            const firstTrack = order?.length
              ? this.queue[order[0]]
              : this.queue[0]
            await this.setTrack(firstTrack, false)
            hasNext = true
          }

          // Only set to false if no next track
          if (!hasNext) {
            this.isPlaying = false
            window.api.info("Queue finished")
          }
        }
      } catch (err) {
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
        audioEl.pause()
        this.isPlaying = false
        return
      }

      if (audioCtx.state === "suspended") await audioCtx.resume()

      // pause - play (track already loaded) vs play new track
      if (audioEl.src) {
        await audioEl.play()
      } else {
        await this.playTrack(this.currentTrack.file_path)
      }
      this.isPlaying = true
    },

    setVolume(level) {
      this.volume = Math.max(0, Math.min(level, 1))
      // Cubic taper approximates perceived loudness so the slider's range
      // feels even, instead of most change being audible only near the top.
      const perceptualGain = this.volume === 0 ? 0 : Math.pow(this.volume, 3)
      gainNode.gain.setTargetAtTime(perceptualGain, audioCtx.currentTime, 0.01)
    },

    setEQBand(index, gainDb) {
      const clamped = Math.max(-12, Math.min(12, gainDb))
      this.eqBands = this.eqBands.map((v, i) => (i === index ? clamped : v))
      this.eqPreset = "Custom"
      if (this.eqEnabled) {
        eqFilters[index].gain.setTargetAtTime(clamped, audioCtx.currentTime, 0.01)
      }
      localStorage.setItem("eqBands", JSON.stringify(this.eqBands))
      localStorage.setItem("eqPreset", "Custom")
    },

    applyEQPreset(name) {
      const bands = EQ_PRESETS[name]
      if (!bands) return
      this.eqBands = bands.slice()
      this.eqPreset = name
      if (this.eqEnabled) {
        eqFilters.forEach((filter, i) => {
          filter.gain.setTargetAtTime(this.eqBands[i], audioCtx.currentTime, 0.01)
        })
      }
      localStorage.setItem("eqBands", JSON.stringify(this.eqBands))
      localStorage.setItem("eqPreset", name)
    },

    setEQEnabled(enabled) {
      this.eqEnabled = enabled
      eqFilters.forEach((filter, i) => {
        const target = enabled ? this.eqBands[i] : 0
        filter.gain.setTargetAtTime(target, audioCtx.currentTime, 0.01)
      })
      localStorage.setItem("eqEnabled", String(enabled))
    },

    setNormalizationEnabled(enabled) {
      this.normalizationEnabled = enabled
      localStorage.setItem("normalizationEnabled", String(enabled))
      if (enabled) {
        resetNormalizationMeasurement()
      } else {
        normalizationGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.01)
      }
    },

    async refreshOutputDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        this.outputDevices = devices.filter((d) => d.kind === "audiooutput")
      } catch (err) {
        console.error("Failed to enumerate output devices:", err)
      }
    },

    // Device labels are hidden until the user grants a media permission at
    // least once (a browser privacy measure) - request+immediately drop a
    // mic stream purely to unlock labels, then re-enumerate.
    async requestDeviceLabelsPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        await this.refreshOutputDevices()
      } catch (err) {
        console.error("Microphone permission denied, device names unavailable:", err)
      }
    },

    async setOutputDevice(deviceId) {
      this.outputDeviceId = deviceId
      localStorage.setItem("outputDeviceId", deviceId)
      if (typeof audioCtx.setSinkId !== "function") return
      try {
        await audioCtx.setSinkId(deviceId)
      } catch (err) {
        console.error("Failed to set output device:", err)
        window.api.showToast?.("Couldn't switch to that output device.", "error")
      }
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

      window.api.info("AudioContext state:", audioCtx.state)
      window.api.info("AudioContext sample rate:", audioCtx.sampleRate)
      window.api.info(
        "AudioContext current time:",
        audioCtx.currentTime.toFixed(2),
        "s"
      )
      window.api.info("Audio element src set:", !!audioEl.src)
      window.api.info("Audio element readyState:", audioEl.readyState)
      window.api.info("Audio element duration:", audioEl.duration)

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

    // Frame-accurate playback position — used for lyric sync, which needs
    // finer-grained updates than the 200ms progress-bar interval.
    getLiveTime() {
      return audioEl.currentTime || this.currentTime
    },

    startProgressUpdater() {
      if (this.progressTimer) clearInterval(this.progressTimer)

      this.progressTimer = setInterval(() => {
        if (this.isPlaying) {
          tickNormalizationMeasurement(this.normalizationEnabled)

          this.currentTime = audioEl.currentTime
          this.duration = isFinite(audioEl.duration)
            ? audioEl.duration
            : this.duration
          this.progress =
            this.duration > 0
              ? Math.min(this.currentTime / this.duration, 1)
              : 0

          // Last.fm scrobble rule: half the track or 4 minutes, whichever
          // is lower, and only for tracks longer than 30s.
          const { artist, title, album } = this.currentTrack
          if (
            !this.scrobbleSent &&
            artist &&
            title &&
            this.duration > 30 &&
            this.currentTime >= Math.min(this.duration / 2, 240)
          ) {
            this.scrobbleSent = true
            window.api.lastfmScrobble({ artist, title, album, duration: this.duration })
          }
        }
      }, 200)
    },

    seekTo(targetTime) {
      if (!this.currentTrack?.file_path) return
      if (!isFinite(audioEl.duration)) return

      // Setting currentTime on a native media element preserves play/pause
      // state on its own — no manual "was it playing" bookkeeping needed.
      const t = Math.max(0, Math.min(targetTime, audioEl.duration))
      audioEl.currentTime = t
      this.currentTime = t
      this.progress = audioEl.duration > 0 ? t / audioEl.duration : 0
    },
  },
})
