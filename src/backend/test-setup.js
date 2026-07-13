import { vi } from "vitest"

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/echovault-test-userdata"),
    getAppPath: vi.fn(() => process.cwd()),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
}))
