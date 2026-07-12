import { app, dialog, ipcMain } from "electron"
import fs from "fs"
import path from "path"
import {
  GET_PROFILE,
  UPSERT_PROFILE_USERNAME,
  UPSERT_PROFILE_AVATAR,
} from "../db/queries.js"

function avatarDir() {
  return path.join(app.getPath("userData"), "avatar")
}

function toAvatarUrl(avatarPath) {
  return avatarPath ? `echovault://${avatarPath}` : null
}

export function registerProfileHandlers(mainWindow, db) {
  ipcMain.handle("profile:get", () => {
    const row = db.prepare(GET_PROFILE).get() || { username: "", avatar_path: null }
    return { username: row.username || "", avatarUrl: toAvatarUrl(row.avatar_path) }
  })

  ipcMain.handle("profile:setUsername", (e, name) => {
    db.prepare(UPSERT_PROFILE_USERNAME).run(String(name || "").trim())
  })

  ipcMain.handle("profile:pickAvatar", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    })
    if (result.canceled || !result.filePaths[0]) {
      return { avatarUrl: null, cancelled: true }
    }

    const srcPath = result.filePaths[0]
    const ext = path.extname(srcPath).toLowerCase()
    const dir = avatarDir()
    fs.mkdirSync(dir, { recursive: true })
    const destPath = path.join(dir, `avatar${ext}`)
    fs.copyFileSync(srcPath, destPath)

    db.prepare(UPSERT_PROFILE_AVATAR).run(destPath)
    return { avatarUrl: toAvatarUrl(destPath) }
  })

  ipcMain.handle("profile:clearAvatar", () => {
    const row = db.prepare(GET_PROFILE).get()
    if (row?.avatar_path) {
      try {
        fs.unlinkSync(row.avatar_path)
      } catch (err) {
        if (err.code !== "ENOENT") throw err
      }
    }
    db.prepare(UPSERT_PROFILE_AVATAR).run(null)
  })
}
