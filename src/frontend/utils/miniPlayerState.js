import { ref } from "vue"

export const isMiniPlayerActive = ref(false)

window.api.checkMiniMode?.().then((active) => {
  isMiniPlayerActive.value = !!active
})

export function enterMiniPlayer() {
  isMiniPlayerActive.value = true
  window.api.enableMiniPlayer?.()
}

export function exitMiniPlayer() {
  isMiniPlayerActive.value = false
  window.api.restoreWindowSize?.()
}
