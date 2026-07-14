import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "backend",
          environment: "node",
          include: ["src/backend/**/*.test.js", "src/main.test.js"],
          setupFiles: ["./src/backend/test-setup.js"],
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/frontend/**/*.{test,spec}.js"],
          setupFiles: ["./src/frontend/test-setup.js"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/backend/**/*.js", "src/frontend/**/*.{js,vue}", "src/main.js"],
      exclude: [
        "src/backend/**/*.test.js",
        "src/frontend/**/*.{test,spec}.js",
        "src/backend/main/enhance.js",
        "src/backend/main/downloader.js",
      ],
    },
  },
})
