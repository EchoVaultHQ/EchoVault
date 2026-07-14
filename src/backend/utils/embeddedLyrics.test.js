import { describe, it, expect } from "vitest"
import { extractEmbeddedLyrics } from "./embeddedLyrics.js"

function metadataWith(format, tags) {
  return { native: { [format]: tags } }
}

describe("extractEmbeddedLyrics", () => {
  it("returns null when metadata is missing", () => {
    expect(extractEmbeddedLyrics(null)).toBeNull()
    expect(extractEmbeddedLyrics(undefined)).toBeNull()
  })

  it("returns null when metadata has no native tags", () => {
    expect(extractEmbeddedLyrics({})).toBeNull()
  })

  it("returns null when there are no lyrics-shaped tags", () => {
    const metadata = metadataWith("id3v2.3", [{ id: "TIT2", value: "Song Title" }])
    expect(extractEmbeddedLyrics(metadata)).toBeNull()
  })

  describe("unsynchronized lyrics (USLT-family tags)", () => {
    it("extracts a plain string value", () => {
      const metadata = metadataWith("id3v2.3", [{ id: "USLT", value: "la la la" }])
      expect(extractEmbeddedLyrics(metadata)).toEqual({
        type: "USLT",
        format: "id3v2.3",
        language: "unknown",
        description: "",
        text: "la la la",
        synchronized: false,
      })
    })

    it("extracts text/language/description from an object value", () => {
      const metadata = metadataWith("id3v2.3", [
        { id: "USLT", value: { text: "  la la la  ", language: "eng", description: "main" } },
      ])
      expect(extractEmbeddedLyrics(metadata)).toEqual({
        type: "USLT",
        format: "id3v2.3",
        language: "eng",
        description: "main",
        text: "la la la",
        synchronized: false,
      })
    })

    it("falls back through lyrics/lyric/content/data/value object keys", () => {
      const metadata = metadataWith("id3v2.3", [{ id: "USLT", value: { lyrics: "fallback text" } }])
      expect(extractEmbeddedLyrics(metadata).text).toBe("fallback text")
    })

    it("extracts from an array of strings", () => {
      const metadata = metadataWith("id3v2.3", [{ id: "USLT", value: ["first line"] }])
      expect(extractEmbeddedLyrics(metadata).text).toBe("first line")
    })

    it("extracts from an array of { text } objects", () => {
      const metadata = metadataWith("id3v2.3", [{ id: "USLT", value: [{ text: "array object line" }] }])
      expect(extractEmbeddedLyrics(metadata).text).toBe("array object line")
    })

    it("skips a USLT tag whose value has no extractable text", () => {
      const metadata = metadataWith("id3v2.3", [{ id: "USLT", value: {} }])
      expect(extractEmbeddedLyrics(metadata)).toBeNull()
    })

    it("matches the vorbis-format LYRICS tag", () => {
      const metadata = metadataWith("vorbis", [{ id: "lyrics", value: "vorbis lyrics" }])
      expect(extractEmbeddedLyrics(metadata)).toMatchObject({ text: "vorbis lyrics", synchronized: false })
    })

    it("matches the APEv2-format LYRICS tag", () => {
      const metadata = metadataWith("APEv2", [{ id: "Lyrics", value: "ape lyrics" }])
      expect(extractEmbeddedLyrics(metadata)).toMatchObject({ text: "ape lyrics", synchronized: false })
    })
  })

  describe("synchronized lyrics (SYLT-family tags)", () => {
    it("extracts a standard SYLT synchronizedText array (ms -> seconds)", () => {
      const metadata = metadataWith("id3v2.4", [
        {
          id: "SYLT",
          value: {
            synchronizedText: [
              { text: "second", timeStamp: 5000 },
              { text: "first", timeStamp: 1000 },
            ],
          },
        },
      ])
      const result = extractEmbeddedLyrics(metadata)
      expect(result.type).toBe("SYLT")
      expect(result.synchronized).toBe(true)
      expect(result.timestamps).toEqual([
        { time: 1, text: "first" },
        { time: 5, text: "second" },
      ])
      expect(result.text).toBe("second\nfirst") // built in input order, unlike the separately-sorted timestamps
    })

    it("extracts a { text, timeStamps } shaped value", () => {
      const metadata = metadataWith("id3v2.4", [
        {
          id: "SYLT",
          value: { text: "first\nsecond", timeStamps: [1000, 2000] },
        },
      ])
      const result = extractEmbeddedLyrics(metadata)
      expect(result.timestamps).toEqual([
        { time: 1, text: "first" },
        { time: 2, text: "second" },
      ])
    })

    it("extracts a bare array of { text, time } entries", () => {
      const metadata = metadataWith("id3v2.4", [
        { id: "SYLT", value: [{ text: "only line", time: 3000 }] },
      ])
      const result = extractEmbeddedLyrics(metadata)
      expect(result.timestamps).toEqual([{ time: 3, text: "only line" }])
    })

    it("extracts via alternate key names (lines/entries/items with time/timestamp/timeStamp)", () => {
      const metadata = metadataWith("id3v2.4", [
        { id: "SYLT", value: { lines: [{ timestamp: 2000, lyric: "alt keys" }] } },
      ])
      const result = extractEmbeddedLyrics(metadata)
      expect(result.timestamps).toEqual([{ time: 2, text: "alt keys" }])
    })

    it("returns null (falls through to no lyrics) when no timestamps could be parsed", () => {
      const metadata = metadataWith("id3v2.4", [{ id: "SYLT", value: { synchronizedText: [] } }])
      expect(extractEmbeddedLyrics(metadata)).toBeNull()
    })

    it("returns null for a malformed/non-object SYLT value instead of throwing", () => {
      const metadata = metadataWith("id3v2.4", [{ id: "SYLT", value: "not an object" }])
      expect(extractEmbeddedLyrics(metadata)).toBeNull()
    })
  })

  describe("TXXX (user-defined) tags", () => {
    it("extracts text when the description matches lyrics keywords, case-insensitively", () => {
      const metadata = metadataWith("id3v2.3", [
        { id: "TXXX", value: { description: "lyrics", text: "custom lyrics text" } },
      ])
      expect(extractEmbeddedLyrics(metadata)).toEqual({
        type: "TXXX",
        format: "id3v2.3",
        description: "lyrics",
        text: "custom lyrics text",
        synchronized: false,
      })
    })

    it("ignores a TXXX tag whose description doesn't match lyrics keywords", () => {
      const metadata = metadataWith("id3v2.3", [
        { id: "TXXX", value: { description: "replaygain_track_gain", text: "-6.5 dB" } },
      ])
      expect(extractEmbeddedLyrics(metadata)).toBeNull()
    })

    it("ignores a TXXX tag with an empty text value", () => {
      const metadata = metadataWith("id3v2.3", [
        { id: "TXXX", value: { description: "LYRICS", text: "   " } },
      ])
      expect(extractEmbeddedLyrics(metadata)).toBeNull()
    })
  })

  it("stops at the first format that yields lyrics, ignoring later formats", () => {
    const metadata = {
      native: {
        "id3v2.3": [{ id: "USLT", value: "first format wins" }],
        vorbis: [{ id: "LYRICS", value: "second format" }],
      },
    }
    expect(extractEmbeddedLyrics(metadata).text).toBe("first format wins")
  })

  it("skips tags with unrecognized ids", () => {
    const metadata = metadataWith("id3v2.3", [
      { id: "TIT2", value: "Title" },
      { id: "TPE1", value: "Artist" },
    ])
    expect(extractEmbeddedLyrics(metadata)).toBeNull()
  })

  it("skips a format whose tags value is not an array", () => {
    const metadata = { native: { "id3v2.3": "not-an-array" } }
    expect(extractEmbeddedLyrics(metadata)).toBeNull()
  })
})
