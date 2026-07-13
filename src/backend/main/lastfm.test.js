import { describe, it, expect, vi, beforeEach } from "vitest"
import path from "path"
import { safeStorage } from "electron"
import {
  getStatus,
  saveCredentials,
  disconnect,
  setEnabled,
  reportNowPlaying,
  reportScrobble,
} from "./lastfm.js"
import { updateNowPlaying, scrobble, enqueueFailedScrobble, flushQueue } from "../utils/lastfmClient.js"

vi.mock("../utils/lastfmClient.js", () => ({
  getToken: vi.fn(),
  buildAuthUrl: vi.fn(),
  getSession: vi.fn(),
  updateNowPlaying: vi.fn(),
  scrobble: vi.fn(),
  enqueueFailedScrobble: vi.fn(),
  flushQueue: vi.fn(),
}))

const files = new Map()

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: {
      ...actual.default,
      readFileSync: vi.fn((filePath) => {
        if (!files.has(filePath)) {
          const err = new Error("ENOENT")
          err.code = "ENOENT"
          throw err
        }
        return files.get(filePath)
      }),
      writeFileSync: vi.fn((filePath, data) => {
        files.set(filePath, data)
      }),
    },
  }
})

const AUTH_PATH = path.join("/tmp/echovault-test-userdata", "lastfm-auth.json")

function encode(value) {
  return Buffer.from(value).toString("base64")
}

function seedAuth({
  apiKey = "key",
  apiSecret = "secret",
  sessionKey = null,
  username = null,
  scrobblingEnabled = false,
} = {}) {
  files.set(
    AUTH_PATH,
    JSON.stringify({
      encryptedApiKey: encode(apiKey),
      encryptedApiSecret: encode(apiSecret),
      encryptedSessionKey: sessionKey ? encode(sessionKey) : null,
      username,
      scrobblingEnabled,
    })
  )
}

beforeEach(() => {
  files.clear()
  vi.clearAllMocks()
  safeStorage.isEncryptionAvailable.mockReturnValue(true)
})

describe("getStatus", () => {
  it("reports no credentials when nothing is stored", () => {
    expect(getStatus()).toEqual({
      hasCredentials: false,
      connected: false,
      username: null,
      scrobblingEnabled: false,
    })
  })

  it("reports connected once a session exists", () => {
    seedAuth({ sessionKey: "sk123", username: "ankush", scrobblingEnabled: true })

    expect(getStatus()).toEqual({
      hasCredentials: true,
      connected: true,
      username: "ankush",
      scrobblingEnabled: true,
    })
  })
})

describe("saveCredentials", () => {
  it("rejects when apiKey or apiSecret is missing", () => {
    expect(saveCredentials({ apiKey: "", apiSecret: "secret" })).toEqual({
      ok: false,
      error: "missing-credentials",
    })
  })

  it("rejects when secure storage isn't available on this system", () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(false)

    expect(saveCredentials({ apiKey: "key", apiSecret: "secret" })).toEqual({
      ok: false,
      error: "secure storage unavailable on this system",
    })
  })

  it("persists credentials, preserving any existing session", () => {
    seedAuth({ sessionKey: "sk123", username: "ankush", scrobblingEnabled: true })

    const result = saveCredentials({ apiKey: "new-key", apiSecret: "new-secret" })

    expect(result).toEqual({ ok: true })
    expect(getStatus()).toEqual({
      hasCredentials: true,
      connected: true,
      username: "ankush",
      scrobblingEnabled: true,
    })
  })
})

describe("disconnect", () => {
  it("clears the session but keeps the stored credentials", () => {
    seedAuth({ sessionKey: "sk123", username: "ankush", scrobblingEnabled: true })

    expect(disconnect()).toEqual({ ok: true })
    expect(getStatus()).toEqual({
      hasCredentials: true,
      connected: false,
      username: null,
      scrobblingEnabled: false,
    })
  })

  it("is a no-op when there are no credentials", () => {
    expect(disconnect()).toEqual({ ok: true })
    expect(getStatus().hasCredentials).toBe(false)
  })
})

describe("setEnabled", () => {
  it("fails when there is no active session", () => {
    seedAuth()
    expect(setEnabled(true)).toEqual({ ok: false, error: "not-connected" })
  })

  it("toggles scrobblingEnabled when connected", () => {
    seedAuth({ sessionKey: "sk123", scrobblingEnabled: false })

    expect(setEnabled(true)).toEqual({ ok: true })
    expect(getStatus().scrobblingEnabled).toBe(true)
  })
})

describe("reportNowPlaying", () => {
  it("does nothing when not connected or scrobbling is disabled", async () => {
    await reportNowPlaying({ artist: "A", title: "B" })
    expect(updateNowPlaying).not.toHaveBeenCalled()
  })

  it("calls updateNowPlaying with the stored session when connected", async () => {
    seedAuth({ sessionKey: "sk123", scrobblingEnabled: true })
    updateNowPlaying.mockResolvedValue({ ok: true })

    await reportNowPlaying({ artist: "A", title: "B" })

    expect(updateNowPlaying).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "key", apiSecret: "secret" }),
      "sk123",
      { artist: "A", title: "B" }
    )
  })
})

describe("reportScrobble", () => {
  it("does nothing when not connected or scrobbling is disabled", async () => {
    await reportScrobble({ artist: "A", title: "B" })
    expect(scrobble).not.toHaveBeenCalled()
  })

  it("flushes the retry queue, then scrobbles when connected", async () => {
    seedAuth({ sessionKey: "sk123", scrobblingEnabled: true })
    scrobble.mockResolvedValue({ ok: true })

    await reportScrobble({ artist: "A", title: "B" })

    expect(flushQueue).toHaveBeenCalled()
    expect(scrobble).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "key", apiSecret: "secret" }),
      "sk123",
      { artist: "A", title: "B" },
      expect.any(Number)
    )
  })

  it("enqueues the scrobble for retry when it fails", async () => {
    seedAuth({ sessionKey: "sk123", scrobblingEnabled: true })
    scrobble.mockResolvedValue({ ok: false, error: "network down" })

    await reportScrobble({ artist: "A", title: "B" })

    expect(enqueueFailedScrobble).toHaveBeenCalled()
  })
})
