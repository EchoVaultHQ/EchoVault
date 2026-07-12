import { defineStore } from "pinia"
import { ref } from "vue"

export const useProfileStore = defineStore("profile", () => {
  const username = ref("")
  const avatarUrl = ref(null)

  async function load() {
    const result = await window.api.profile.get()
    username.value = result.username || ""
    avatarUrl.value = result.avatarUrl
  }

  async function setUsername(name) {
    username.value = name.trim()
    await window.api.profile.setUsername(username.value)
  }

  async function pickAvatar() {
    const result = await window.api.profile.pickAvatar()
    if (result.avatarUrl) avatarUrl.value = result.avatarUrl
  }

  async function clearAvatar() {
    await window.api.profile.clearAvatar()
    avatarUrl.value = null
  }

  return { username, avatarUrl, load, setUsername, pickAvatar, clearAvatar }
})
