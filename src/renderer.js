// set theme before Vue app mounts (fixes white scrollbar flash)
const savedTheme = localStorage.getItem("theme") || "dark"
document.documentElement.setAttribute("data-theme", savedTheme)

// set accent color before Vue app mounts (fixes flash of default accent)
const savedAccent = localStorage.getItem("accentColor")
if (savedAccent) {
  document.documentElement.style.setProperty("--accent", savedAccent)
}

import { createApp } from "vue"
import { createPinia } from "pinia"
import App from "./frontend/App.vue"
import router from "./frontend/router"
import "./frontend/assets/index.css"
import "@fortawesome/fontawesome-free/css/all.css"
import { createI18n } from "vue-i18n"
import en from "./locales/en.json"
import ja from "./locales/ja.json"

const i18n = createI18n({
  legacy: false,
  locale: "en", // default
  fallbackLocale: "en",
  messages: { en, ja },
})

const pinia = createPinia()

createApp(App).use(router).use(pinia).use(i18n).mount("#app")
