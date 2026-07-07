import { ipcMain } from "electron"

export function registerWindowHandlers(mainWindow) {
  ipcMain.on("win:minimize", () => {
    mainWindow.minimize()
  })

  ipcMain.on("win:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })

  ipcMain.on("win:close", () => {
    mainWindow.close()
  })

  ipcMain.handle("win:isMaximized", () => {
    return mainWindow.isMaximized()
  })

  ipcMain.handle("win:set-immersive-mode", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(true)
    }
  })

  ipcMain.handle("win:reset-immersive-mode", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(false)
    }
  })
}
