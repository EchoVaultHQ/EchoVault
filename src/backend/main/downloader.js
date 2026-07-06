import fs from "node:fs"
import path from "node:path"
import https from "node:https"
import http from "node:http"
import crypto from "node:crypto"
import { app } from "electron"
import log from "../../logger.js"

const MAX_REDIRECTS = 5

/**
 * Resolves the bundled enhancer-manifest.json, mirroring initDB's schema.sql lookup
 * (packaged resourcesPath first, then dev build dir, then app path fallback).
 * @returns {object} parsed manifest
 */
function readManifest() {
  const candidates = [
    path.join(process.resourcesPath, "enhancer-manifest.json"),
    path.join(__dirname, "enhancer-manifest.json"),
    path.join(app.getAppPath(), "enhancer-manifest.json"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"))
  }
  throw new Error("enhancer-manifest.json not found in any known location")
}

/** platform key used inside the manifest's `binary` map */
function platformKey() {
  return process.platform === "win32" ? "win32" : "linux"
}

function enhancerDir() {
  return path.join(app.getPath("userData"), "enhancer")
}

/**
 * Absolute paths to the (possibly not-yet-downloaded) enhancer assets.
 */
export function getEnhancerPaths() {
  const manifest = readManifest()
  const bin = manifest.binary[platformKey()]
  const dir = enhancerDir()
  return {
    dir,
    binaryPath: path.join(dir, "bin", bin.file),
    modelPath: path.join(dir, "model", manifest.model.file),
    configPath: path.join(dir, "model", manifest.config.file),
  }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256")
    const stream = fs.createReadStream(filePath)
    stream.on("error", reject)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolve(hash.digest("hex")))
  })
}

/** A file is considered present if it exists and (when pinned) its sha256 matches. */
async function isAssetValid(filePath, expectedSha) {
  if (!fs.existsSync(filePath)) return false
  if (!expectedSha) return true // unpinned (dev/placeholder) — trust presence, warn elsewhere
  const actual = await sha256File(filePath)
  return actual.toLowerCase() === expectedSha.toLowerCase()
}

/**
 * Builds the list of assets that still need downloading.
 * @returns {Promise<{ready: boolean, totalBytes: number, items: Array}>}
 */
export async function checkReady() {
  const manifest = readManifest()
  const paths = getEnhancerPaths()
  const bin = manifest.binary[platformKey()]

  const all = [
    { name: "model", url: `${manifest.baseUrl}/${manifest.model.file}`, dest: paths.modelPath, sha256: manifest.model.sha256, bytes: manifest.model.bytes || 0 },
    { name: "config", url: `${manifest.baseUrl}/${manifest.config.file}`, dest: paths.configPath, sha256: manifest.config.sha256, bytes: manifest.config.bytes || 0 },
    { name: "binary", url: `${manifest.baseUrl}/${bin.file}`, dest: paths.binaryPath, sha256: bin.sha256, bytes: bin.bytes || 0 },
  ]

  const items = []
  for (const a of all) {
    if (!(await isAssetValid(a.dest, a.sha256))) items.push(a)
  }
  const totalBytes = items.reduce((sum, a) => sum + a.bytes, 0)
  return { ready: items.length === 0, totalBytes, items }
}

/**
 * Streams `url` to `dest`, following redirects. Reports raw byte deltas via onBytes(delta).
 */
function downloadTo(url, dest, onBytes, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http
    const req = client.get(url, { headers: { "User-Agent": "EchoVault" } }, (res) => {
      // GitHub release assets 302 to a signed CDN URL.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirectsLeft <= 0) return reject(new Error("too many redirects"))
        return resolve(downloadTo(res.headers.location, dest, onBytes, redirectsLeft - 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`download failed: HTTP ${res.statusCode} for ${url}`))
      }

      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const tmp = `${dest}.part`
      const out = fs.createWriteStream(tmp)
      res.on("data", (chunk) => onBytes(chunk.length))
      res.pipe(out)
      out.on("error", reject)
      out.on("finish", () =>
        out.close(() => {
          try {
            fs.renameSync(tmp, dest)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
      )
    })
    req.on("error", reject)
  })
}

/**
 * Ensures the frozen inference binary + model + config are present and verified in
 * userData/enhancer. Downloads whatever is missing/corrupt and reports cumulative
 * download progress via onProgress({ phase:"download", pct, message }).
 *
 * @returns {Promise<{binaryPath: string, modelPath: string, configPath: string}>}
 */
export async function ensureEnhancerAssets(onProgress = () => {}) {
  const paths = getEnhancerPaths()
  const { ready, totalBytes, items } = await checkReady()
  if (ready) return paths

  let completedBytes = 0
  for (const asset of items) {
    log.info(`downloader :: fetching ${asset.name} from ${asset.url}`)

    // Retry transient failures (fresh-upload/CDN propagation, flaky network). The
    // per-attempt byte counter resets so cumulative progress stays monotonic.
    await withRetry(
      async () => {
        let attemptBytes = 0
        await downloadTo(asset.url, asset.dest, (delta) => {
          attemptBytes += delta
          onProgress({
            phase: "download",
            pct: pctOf(completedBytes + attemptBytes, totalBytes),
            message: `Downloading ${asset.name}…`,
          })
        })
      },
      { attempts: 3, baseMs: 1000, label: asset.name }
    )
    completedBytes += asset.bytes

    if (asset.sha256) {
      const actual = await sha256File(asset.dest)
      if (actual.toLowerCase() !== asset.sha256.toLowerCase()) {
        fs.rmSync(asset.dest, { force: true })
        throw new Error(`checksum mismatch for ${asset.name} (expected ${asset.sha256}, got ${actual})`)
      }
    } else {
      log.warn(`downloader :: ${asset.name} has no pinned sha256 — integrity not verified`)
    }
  }

  // Frozen binary must be executable on Unix.
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(paths.binaryPath, 0o755)
    } catch (err) {
      log.warn("downloader :: chmod failed:", err.message)
    }
  }

  onProgress({ phase: "download", pct: 100, message: "Download complete" })
  return paths
}

function pctOf(done, total) {
  if (!total) return null // indeterminate when manifest omits byte sizes
  return Math.min(100, Math.round((done / total) * 100))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Transient = network/stream errors, or HTTP 404 (fresh upload)/408/429/5xx. */
function isTransient(err) {
  const msg = String(err?.message || "")
  const httpMatch = msg.match(/HTTP (\d{3})/)
  if (httpMatch) {
    const code = Number(httpMatch[1])
    return code === 404 || code === 408 || code === 429 || code >= 500
  }
  return true // no HTTP status => socket/DNS/timeout error
}

async function withRetry(fn, { attempts = 3, baseMs = 1000, label = "" } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isTransient(err)) throw err
      const delay = baseMs * 2 ** i
      log.warn(
        `downloader :: ${label} attempt ${i + 1}/${attempts} failed (${err.message}); retrying in ${delay}ms`
      )
      await sleep(delay)
    }
  }
  throw lastErr
}
