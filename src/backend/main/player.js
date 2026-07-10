import { ipcMain, BrowserWindow } from "electron"
import fs from "fs"

export function registerPlayerHandlers(mainWindow, db) {
  ipcMain.handle("player:play", (event, trackPath) => {
    try {
      const data = fs.readFileSync(trackPath)
      // return buffer
      return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      )
    } catch (err) {
      console.error("Failed to read audio file:", err)
      throw err
    }
  })

  ipcMain.handle("player:getFileSize", (event, trackPath) => {
    try {
      return fs.statSync(trackPath).size
    } catch (err) {
      console.error("Failed to get file size:", err)
      throw err
    }
  })

  let isProgrammaticResize = false
  let isInMiniMode = false

  ipcMain.handle("enable-mini-player", () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && !isProgrammaticResize && !isInMiniMode) {
      isProgrammaticResize = true
      isInMiniMode = true

      // Disable resizing first
      win.setResizable(false)

      // Set fixed mini player size
      const miniWidth = 350
      const miniHeight = 500

      win.setMinimumSize(miniWidth, miniHeight)
      win.setMaximumSize(miniWidth, miniHeight)
      win.setSize(miniWidth, miniHeight)
      win.center()

      setTimeout(() => {
        isProgrammaticResize = false
      }, 600)
    }
  })

  ipcMain.handle("restore-window-size", () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && !isProgrammaticResize && isInMiniMode) {
      isProgrammaticResize = true
      isInMiniMode = false

      // Re-enable resizing first
      win.setResizable(true)

      // Remove size constraints
      const normalWidth = 1280
      const normalHeight = 700
      const minWidth = 350
      const minHeight = 634

      win.setMinimumSize(minWidth, minHeight)
      win.setMaximumSize(0, 0) // remove maximum size limit

      // Restore normal window size
      win.setSize(normalWidth, normalHeight)
      win.center()

      setTimeout(() => {
        isProgrammaticResize = false
      }, 600)
    }
  })

  // manual window resize
  ipcMain.handle("check-mini-mode", () => {
    return isInMiniMode
  })
}
