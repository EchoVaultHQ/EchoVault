import { describe, it, expect, vi, beforeEach } from "vitest"
import { ipcMain } from "electron"
import { registerWindowHandlers } from "./window.js"

function getHandler(mockFn, channel) {
  const call = mockFn.mock.calls.find(([ch]) => ch === channel)
  return call?.[1]
}

let mainWindow

beforeEach(() => {
  vi.clearAllMocks()
  mainWindow = {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(),
    setFullScreen: vi.fn(),
  }
  registerWindowHandlers(mainWindow)
})

describe("win:minimize", () => {
  it("minimizes the window", () => {
    getHandler(ipcMain.on, "win:minimize")()
    expect(mainWindow.minimize).toHaveBeenCalled()
  })
})

describe("win:maximize", () => {
  it("maximizes when not already maximized", () => {
    mainWindow.isMaximized.mockReturnValue(false)
    getHandler(ipcMain.on, "win:maximize")()
    expect(mainWindow.maximize).toHaveBeenCalled()
    expect(mainWindow.unmaximize).not.toHaveBeenCalled()
  })

  it("unmaximizes when already maximized", () => {
    mainWindow.isMaximized.mockReturnValue(true)
    getHandler(ipcMain.on, "win:maximize")()
    expect(mainWindow.unmaximize).toHaveBeenCalled()
    expect(mainWindow.maximize).not.toHaveBeenCalled()
  })
})

describe("win:close", () => {
  it("closes the window", () => {
    getHandler(ipcMain.on, "win:close")()
    expect(mainWindow.close).toHaveBeenCalled()
  })
})

describe("win:isMaximized", () => {
  it("returns the window's maximized state", () => {
    mainWindow.isMaximized.mockReturnValue(true)
    expect(getHandler(ipcMain.handle, "win:isMaximized")()).toBe(true)
  })
})

describe("win:set-immersive-mode / win:reset-immersive-mode", () => {
  it("toggles full screen on and off", () => {
    getHandler(ipcMain.handle, "win:set-immersive-mode")()
    expect(mainWindow.setFullScreen).toHaveBeenCalledWith(true)

    getHandler(ipcMain.handle, "win:reset-immersive-mode")()
    expect(mainWindow.setFullScreen).toHaveBeenCalledWith(false)
  })
})
