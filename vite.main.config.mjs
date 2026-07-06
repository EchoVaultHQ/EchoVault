import { defineConfig } from "vite"
import path, { resolve } from "path"
import fs from "fs"

export default defineConfig({
  build: {
    sourcemap: false,
    minify: "esbuild",
    cssCodeSplit: true,
    target: "esnext",
    rollupOptions: {
      external: ["better-sqlite3", "fs", "path", "os"],
    },
  },
  server: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: echovault-cover:; media-src 'self' echovault-cover: file:;",
    },
  },
  plugins: [
    {
      name: "copy-schema",
      closeBundle() {
        // Note : Dont move this function to vite.config.js as vite not able to recognize it
        // dont modify if u dont know the build process

        // manually copy app icon and schema to build folder to maintain path
        function copyAppIcon() {
          const src = resolve(
            __dirname,
            "src/frontend/assets/icons/app-icon.png"
          )
          const destDir = resolve(__dirname, ".vite/build/assets/icons")
          const dest = path.join(destDir, "app-icon.png")

          try {
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true })
            }

            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest)
              console.log("Copied app-icon.png to build folder:", dest)
            } else {
              console.warn("app-icon.png not found at:", src)
            }
          } catch (err) {
            console.error("Failed to copy app icon:", err)
          }
        }

        copyAppIcon()

        const src = resolve(__dirname, "src/backend/db/schema.sql")
        const dest = resolve(__dirname, ".vite/build/schema.sql")

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
          console.log("Copied schema.sql to build folder at :", src)
        } else {
          console.warn("schema.sql not found at:", src)
        }

        // copy the enhancer download manifest so downloader.js can resolve it
        // via __dirname (same strategy initDB uses for schema.sql)
        const manifestSrc = resolve(__dirname, "enhancer-manifest.json")
        const manifestDest = resolve(
          __dirname,
          ".vite/build/enhancer-manifest.json"
        )
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDest)
          console.log(
            "Copied enhancer-manifest.json to build folder at :",
            manifestSrc
          )
        } else {
          console.warn("enhancer-manifest.json not found at:", manifestSrc)
        }
      },
    },
  ],
})
