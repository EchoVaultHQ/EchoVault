import assert from "node:assert/strict"
import { fetchLyricsFromLrclib } from "./lrclibClient.js"

const originalFetch = global.fetch

// successful match
{
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ syncedLyrics: "[00:01.00]Hello\n[00:02.00]World" }),
  })
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
    duration: 120,
  })
  assert.equal(reason, "ok")
  assert.deepEqual(lyrics.timestamps, [
    { startTime: 1, text: "Hello", endTime: 2 },
    { startTime: 2, text: "World", endTime: Infinity },
  ])
}

// no match (404)
{
  global.fetch = async () => ({ ok: false, status: 404 })
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
  })
  assert.equal(lyrics, null)
  assert.equal(reason, "http-404")
}

// 200 response but no synced lyrics available
{
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ plainLyrics: "text only, no sync" }),
  })
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
  })
  assert.equal(lyrics, null)
  assert.equal(reason, "no-synced-lyrics")
}

// album-qualified miss, album-less retry hits
{
  global.fetch = async (url) => {
    if (url.includes("album_name")) return { ok: false, status: 404 }
    return {
      ok: true,
      json: async () => ({ syncedLyrics: "[00:05.00]Retry hit" }),
    }
  }
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
    album: "Wrong Album",
  })
  assert.equal(reason, "ok")
  assert.deepEqual(lyrics.timestamps, [
    { startTime: 5, text: "Retry hit", endTime: Infinity },
  ])
}

// both album-qualified and album-less miss
{
  global.fetch = async () => ({ ok: false, status: 404 })
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
    album: "Wrong Album",
  })
  assert.equal(lyrics, null)
  assert.equal(reason, "http-404")
}

// network error
{
  global.fetch = async () => {
    throw new Error("network down")
  }
  const { lyrics, reason } = await fetchLyricsFromLrclib({
    artist: "A",
    title: "B",
  })
  assert.equal(lyrics, null)
  assert.equal(reason, "network-error: network down")
}

global.fetch = originalFetch
console.log("lrclibClient self-check passed")
