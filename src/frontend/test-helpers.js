import { createRouter, createWebHashHistory } from "vue-router"
import { createI18n } from "vue-i18n"
import { mount, shallowMount } from "@vue/test-utils"
import en from "../locales/en.json"

export function createTestRouter(routes = [{ path: "/:pathMatch(.*)*", component: { template: "<div/>" } }]) {
  return createRouter({ history: createWebHashHistory(), routes })
}

export function createTestI18n() {
  return createI18n({ legacy: false, locale: "en", fallbackLocale: "en", messages: { en } })
}

export function mountWithPlugins(Component, { router, shallow = false, ...options } = {}) {
  const fn = shallow ? shallowMount : mount
  return fn(Component, {
    ...options,
    global: {
      plugins: [router ?? createTestRouter(), createTestI18n()],
      ...options.global,
    },
  })
}
