import { defineStore } from "pinia"
import { ref } from "vue"

export const accentColors = [
  { key: "blue", value: "#3498db" },
  { key: "purple", value: "#8e44ad" },
  { key: "green", value: "#27ae60" },
  { key: "orange", value: "#e67e22" },
  { key: "pink", value: "#e84393" },
  { key: "red", value: "#c0392b" },
  { key: "teal", value: "#1abc9c" },
  { key: "indigo", value: "#6c5ce7" },
]

function hexToRgba(hex, alpha = 0.25) {
  const c = hex.replace("#", "")
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function adjustBrightness(hex, factor) {
  const col = hex.replace("#", "")
  const r = parseInt(col.substring(0, 2), 16)
  const g = parseInt(col.substring(2, 4), 16)
  const b = parseInt(col.substring(4, 6), 16)
  const newR = Math.min(255, Math.floor(r * factor))
  const newG = Math.min(255, Math.floor(g * factor))
  const newB = Math.min(255, Math.floor(b * factor))
  return `rgb(${newR}, ${newG}, ${newB})`
}

export const useAccentStore = defineStore("accent", () => {
  const accentColor = ref(localStorage.getItem("accentColor") || "#3498db")

  function applyDomAccent(color) {
    document.documentElement.style.setProperty("--accent", color)
    document.documentElement.style.setProperty(
      "--accent-hover",
      adjustBrightness(color, 1.15)
    )
    document.documentElement.style.setProperty(
      "--hover-bg",
      hexToRgba(color, 0.2)
    )
  }

  function setAccent(color) {
    accentColor.value = color
    localStorage.setItem("accentColor", color)
    applyDomAccent(color)
  }

  applyDomAccent(accentColor.value)

  return { accentColor, accentColors, setAccent }
})
