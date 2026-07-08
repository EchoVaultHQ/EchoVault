import fs from "node:fs"
import { parseStream } from "music-metadata"
import log from "../../logger.js"

/**
 * music-metadata picks a container parser primarily by file extension.
 * A mislabeled/renamed download (e.g. an ".m4a" that's actually raw MP3 data)
 * makes it select the wrong parser and throw (e.g. "FourCC contains invalid
 * characters" from the MP4 atom parser reading MP3 sync bytes). Sniffing the
 * real container from magic bytes and passing it as an explicit mimeType lets
 * ParserFactory prefer content-type over the (possibly wrong) extension.
 */
async function detectMimeType(filePath) {
  let fd
  try {
    fd = await fs.promises.open(filePath, "r")
    const buf = Buffer.alloc(16)
    const { bytesRead } = await fd.read(buf, 0, 16, 0)
    if (bytesRead < 4) return null

    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return "audio/mpeg" // ID3
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio/mpeg" // MPEG frame sync
    if (buf.toString("ascii", 0, 4) === "fLaC") return "audio/flac"
    if (bytesRead >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "audio/mp4"
    if (buf.toString("ascii", 0, 4) === "RIFF") return "audio/wave"
    if (buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg"
    return null
  } catch (err) {
    log.debug("audioMeta :: detectMimeType :: failed to sniff", filePath, "::", err.message)
    return null
  } finally {
    if (fd) await fd.close()
  }
}

export async function parseAudioFile(filePath) {
  const stat = await fs.promises.stat(filePath)
  const mimeType = await detectMimeType(filePath)
  const stream = fs.createReadStream(filePath)
  return parseStream(stream, { mimeType: mimeType || undefined, path: filePath, size: stat.size }, {})
}
