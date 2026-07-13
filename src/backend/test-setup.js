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
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value) => Buffer.from(value, "utf-8")),
    decryptString: vi.fn((buf) => buf.toString("utf-8")),
  },
  shell: {
    openExternal: vi.fn(),
  },
}))
