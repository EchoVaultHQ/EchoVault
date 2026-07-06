import { defineStore } from "pinia"
import { ref } from "vue"

/**
 * Drives the mp3 -> flac enhancement flow from the renderer.
 * Live progress arrives via the `enhance:progress` IPC event; the terminal
 * result (success/cancel/error) comes back from the enhanceTrack invoke itself.
 */
export const useEnhanceStore = defineStore("enhance", () => {
  // trackId -> { phase: "starting"|"download"|"enhance", pct: number|null, message }
  const progress = ref({})
  // bumped on every successful enhancement so list views can reload themselves
  const completedCount = ref(0)

  let progressWired = false
  function wireProgress() {
    if (progressWired || !window.api?.onEnhanceProgress) return
    progressWired = true
    window.api.onEnhanceProgress((d) => {
      progress.value = {
        ...progress.value,
        [d.trackId]: { phase: d.phase, pct: d.pct, message: d.message },
      }
    })
  }

  function clear(trackId) {
    const next = { ...progress.value }
    delete next[trackId]
    progress.value = next
  }

  function isEnhancing(trackId) {
    return !!progress.value[trackId]
  }

  async function enhance(track) {
    wireProgress()
    if (progress.value[track.id]) return // already running

    progress.value = {
      ...progress.value,
      [track.id]: { phase: "starting", pct: null, message: "Starting…" },
    }

    let res
    try {
      res = await window.api.enhanceTrack(track.id)
    } catch (err) {
      window.api.showToast?.("Enhancement failed to start.", "error")
      window.api.error?.(`enhance store :: ${err?.message || err}`)
      clear(track.id)
      return
    }

    clear(track.id)

    if (res?.success) {
      completedCount.value++
      window.api.showToast?.(
        `"${track.title || "Track"}" enhanced.`,
        "success"
      )
    } else if (res?.canceled) {
      // user declined the download prompt — stay silent
    } else {
      window.api.showToast?.(res?.error || "Enhancement failed.", "error")
    }
  }

  return { progress, completedCount, enhance, isEnhancing }
})
