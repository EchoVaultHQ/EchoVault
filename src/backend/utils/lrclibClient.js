import { parseLrc } from "./lrcParser.js"

const LRCLIB_ENDPOINT = "https://lrclib.net/api/get"
const TIMEOUT_MS = 5000
// ponytail: hardcoded rather than read from package.json at runtime —
// import.meta.url isn't a real file:// URL once Vite bundles the main
// process, so a dynamic read crashes the packaged app on startup.
const USER_AGENT = "EchoVault/1.0.1-beta (+https://github.com/ACS-lessgo/EchoVault)"

async function requestLrclib(params) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${LRCLIB_ENDPOINT}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    })

    if (!response.ok) {
      return { lyrics: null, reason: `http-${response.status}` }
    }

    const data = await response.json()
    if (!data?.syncedLyrics) {
      return { lyrics: null, reason: "no-synced-lyrics" }
    }

    return { lyrics: parseLrc(data.syncedLyrics), reason: "ok" }
  } catch (err) {
    if (err.name === "AbortError") {
      return { lyrics: null, reason: "timeout" }
    }
    return { lyrics: null, reason: `network-error: ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchLyricsFromLrclib({ artist, title, album, duration }) {
  if (!artist || !title) return { lyrics: null, reason: "missing-artist-or-title" }

  const baseParams = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  })
  if (duration) baseParams.set("duration", String(Math.round(duration)))

  if (album) {
    const withAlbum = new URLSearchParams(baseParams)
    withAlbum.set("album_name", album)
    const withAlbumResult = await requestLrclib(withAlbum)
    if (withAlbumResult.lyrics) return withAlbumResult
  }

  return requestLrclib(baseParams)
}
