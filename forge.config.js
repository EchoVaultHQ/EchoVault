const path = require("path")
const { FusesPlugin } = require("@electron-forge/plugin-fuses")
const { FuseV1Options, FuseVersion } = require("@electron/fuses")

module.exports = {
  // IMP : dont touch the packagerConfig
  packagerConfig: {
    icon: path.join(__dirname, "src/frontend/assets/icons/app-icon"),
    executableName: "echovault",
    asar: {
      unpack: "*.{node,dll}",
    },
    // ignore node_modules and use it on runtime
    // dont modify this
    // onnx/ is dev-only tooling + the committed model + local build binaries — the
    // AI enhancer downloads its own binary/model into userData/enhancer at runtime
    // (see downloader.js), so none of onnx/ should ship inside the packaged app.
    ignore: [/node_modules\/(?!(better-sqlite3|bindings|file-uri-to-path)\/)/, /(^|[\\/])onnx[\\/]/],
  },
  rebuildConfig: {
    force: true,
  },
  makers: [
    // Windows Installer
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        icon: path.join(__dirname, "src/frontend/assets/icons/app-icon.ico"),
      },
    },

    // macOS ZIP (optional)
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },

    // Linux .deb
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          icon: path.join(__dirname, "src/frontend/assets/icons/app-icon.png"),
          categories: ["AudioVideo", "Audio", "Player"],
          genericName: "Music Player",
          description: "A modern music player for lossless audio formats",
        },
      },
    },

    // Linux AppImage (portable)
    {
      name: "@reforged/maker-appimage",
      config: {
        options: {
          icon: path.join(__dirname, "src/frontend/assets/icons/app-icon.png"),
          categories: ["AudioVideo", "Audio", "Player"],
          genericName: "Music Player",
          description: "A modern music player for lossless audio formats",
          bin: "echovault",
        },
      },
    },
    // {
    //   name: "@electron-forge/maker-rpm",
    //   config: {},
    // },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: { owner: "ACS-lessgo", name: "EchoVault" },
        prerelease: false,
        draft: true,
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: "src/main.js",
            config: "vite.main.config.mjs",
            target: "main",
          },
          {
            entry: "src/preload.js",
            config: "vite.preload.config.mjs",
            target: "preload",
          },
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.mjs",
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
