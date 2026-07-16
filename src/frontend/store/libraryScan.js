import { defineStore } from "pinia"
import { ref, computed } from "vue"

/**
 * Drives the Add Folder / Rescan Library progress UI. Live progress arrives
 * via the `library:scan-progress` IPC event; the terminal result (updated
 * folder list) comes back from the addFolder/rescanLibrary invoke itself.
 */
export const useLibraryScanStore = defineStore("libraryScan", () => {
  // null when idle; otherwise { phase, current, total, pct, message, folderPath }
  const progress = ref(null)

  let progressWired = false
  function wireProgress() {
    if (progressWired || !window.api?.onLibraryScanProgress) return
    progressWired = true
    window.api.onLibraryScanProgress((d) => {
      progress.value = d
    })
  }

  const isScanning = computed(() => progress.value !== null)

  function isFolderScanning(folderPath) {
    return progress.value?.folderPath === folderPath
  }

  // Called synchronously the instant the user clicks - covers the brief
  // pre-count window on the backend before the first real event lands.
  function start(phase) {
    wireProgress()
    progress.value = { phase, current: 0, total: 0, pct: 0, message: null, folderPath: null }
  }

  function clear() {
    progress.value = null
  }

  return { progress, isScanning, isFolderScanning, start, clear }
})
