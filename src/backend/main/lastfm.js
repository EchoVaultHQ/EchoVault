import { ipcMain, shell, safeStorage, app } from "electron"
import fs from "fs"
import path from "path"
import log from "../../logger.js"
import {
  getToken,
  buildAuthUrl,
  getSession,
  updateNowPlaying,
  scrobble,
  enqueueFailedScrobble,
  flushQueue,
} from "../utils/lastfmClient.js"

function getAuthPath() {
  return path.join(app.getPath("userData"), "lastfm-auth.json")
}

function getQueuePath() {
  return path.join(app.getPath("userData"), "lastfm-queue.json")
}

function decrypt(base64) {
  return safeStorage.decryptString(Buffer.from(base64, "base64"))
}

function encrypt(value) {
  return safeStorage.encryptString(value).toString("base64")
}

function readAuth() {
  try {
    const raw = JSON.parse(fs.readFileSync(getAuthPath(), "utf-8"))
    return {
      apiKey: decrypt(raw.encryptedApiKey),
      apiSecret: decrypt(raw.encryptedApiSecret),
      sessionKey: raw.encryptedSessionKey ? decrypt(raw.encryptedSessionKey) : null,
      username: raw.username ?? null,
      scrobblingEnabled: raw.scrobblingEnabled ?? false,
    }
  } catch {
    return null
  }
}

function writeAuth({ apiKey, apiSecret, sessionKey, username, scrobblingEnabled }) {
  fs.writeFileSync(
    getAuthPath(),
    JSON.stringify({
      encryptedApiKey: encrypt(apiKey),
      encryptedApiSecret: encrypt(apiSecret),
      encryptedSessionKey: sessionKey ? encrypt(sessionKey) : null,
      username: username ?? null,
      scrobblingEnabled: scrobblingEnabled ?? false,
    })
  )
}

export function registerLastfmHandlers() {
  let pendingToken = null

  ipcMain.handle("lastfm:get-status", () => {
    const auth = readAuth()
    return {
      hasCredentials: !!auth,
      connected: !!auth?.sessionKey,
      username: auth?.username ?? null,
      scrobblingEnabled: auth?.scrobblingEnabled ?? false,
    }
  })

  ipcMain.handle("lastfm:save-credentials", (event, { apiKey, apiSecret }) => {
    if (!apiKey || !apiSecret) return { ok: false, error: "missing-credentials" }
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: "secure storage unavailable on this system" }
    }

    const existing = readAuth()
    writeAuth({
      apiKey,
      apiSecret,
      sessionKey: existing?.sessionKey,
      username: existing?.username,
      scrobblingEnabled: existing?.scrobblingEnabled,
    })
    return { ok: true }
  })

  ipcMain.handle("lastfm:connect", async () => {
    const auth = readAuth()
    if (!auth) return { ok: false, error: "no-credentials" }

    const result = await getToken(auth)
    if (!result.ok) return result

    pendingToken = result.token
    shell.openExternal(buildAuthUrl(auth, result.token))
    return { ok: true }
  })

  ipcMain.handle("lastfm:confirm-auth", async () => {
    const auth = readAuth()
    if (!auth) return { ok: false, error: "no-credentials" }
    if (!pendingToken) return { ok: false, error: "no pending authorization" }

    const result = await getSession(auth, pendingToken)
    pendingToken = null
    if (!result.ok) return result

    writeAuth({
      apiKey: auth.apiKey,
      apiSecret: auth.apiSecret,
      sessionKey: result.sessionKey,
      username: result.username,
      scrobblingEnabled: true,
    })
    return { ok: true, username: result.username }
  })

  ipcMain.handle("lastfm:disconnect", () => {
    const auth = readAuth()
    if (auth) {
      writeAuth({
        apiKey: auth.apiKey,
        apiSecret: auth.apiSecret,
        sessionKey: null,
        username: null,
        scrobblingEnabled: false,
      })
    }
    return { ok: true }
  })

  ipcMain.handle("lastfm:set-enabled", (event, enabled) => {
    const auth = readAuth()
    if (!auth?.sessionKey) return { ok: false, error: "not-connected" }
    writeAuth({ ...auth, scrobblingEnabled: enabled })
    return { ok: true }
  })

  ipcMain.handle("lastfm:now-playing", async (event, track) => {
    const auth = readAuth()
    if (!auth?.sessionKey || !auth.scrobblingEnabled || !track?.artist || !track?.title) return
    const result = await updateNowPlaying(auth, auth.sessionKey, track)
    if (!result.ok) {
      log.error("lastfm :: now-playing update failed:", result.error)
    }
  })

  ipcMain.handle("lastfm:scrobble", async (event, track) => {
    const auth = readAuth()
    if (!auth?.sessionKey || !auth.scrobblingEnabled || !track?.artist || !track?.title) return

    flushQueue(getQueuePath())

    const timestamp = Math.floor(Date.now() / 1000)
    const result = await scrobble(auth, auth.sessionKey, track, timestamp)
    if (!result.ok) {
      log.error("lastfm :: scrobble failed:", result.error)
      enqueueFailedScrobble(getQueuePath(), auth, auth.sessionKey, track, timestamp)
    }
  })
}
