import https from "node:https"
import { app } from "electron"
import log from "../../logger.js"

const RELEASES_URL = "https://api.github.com/repos/ACS-lessgo/EchoVault/releases/latest"
const MAX_REDIRECTS = 5

/** Fetches and JSON-parses `url`, following redirects (GitHub API requires a User-Agent). */
function fetchJson(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "EchoVault", Accept: "application/vnd.github+json" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (redirectsLeft <= 0) return reject(new Error("too many redirects"))
          return resolve(fetchJson(res.headers.location, redirectsLeft - 1))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`GitHub API request failed: HTTP ${res.statusCode}`))
        }
        let body = ""
        res.setEncoding("utf-8")
        res.on("data", (chunk) => (body += chunk))
        res.on("end", () => {
          try {
            resolve(JSON.parse(body))
          } catch (err) {
            reject(err)
          }
        })
      }
    )
    req.on("error", reject)
  })
}

/** Strips a leading "v" and any pre-release/build suffix, e.g. "v2.3.0-beta" -> [2, 3, 0]. */
export function parseVersion(raw) {
  const core = String(raw).replace(/^v/i, "").split(/[-+]/)[0]
  const parts = core.split(".").map((n) => Number.parseInt(n, 10) || 0)
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0]
}

/** True if `a` is strictly greater than `b`, comparing major.minor.patch numerically. */
export function isNewer(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/**
 * Checks the latest GitHub release against the running app version.
 * Never throws — network/API failures are logged and reported as "no update".
 * @returns {Promise<{available: boolean, version?: string, url?: string}>}
 */
export async function checkForUpdates() {
  try {
    const release = await fetchJson(RELEASES_URL)
    if (!release?.tag_name) return { available: false }

    const latest = parseVersion(release.tag_name)
    const current = parseVersion(app.getVersion())

    if (isNewer(latest, current)) {
      return { available: true, version: release.tag_name.replace(/^v/i, ""), url: release.html_url }
    }
    return { available: false }
  } catch (err) {
    log.warn(`updateCheck :: check failed (treating as no update): ${err.message}`)
    return { available: false }
  }
}
