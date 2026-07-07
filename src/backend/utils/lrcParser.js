const TIMESTAMP_TAGS = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
const LINE_PATTERN = /^((?:\[\d{2}:\d{2}\.\d{2,3}\])+)(.*)$/

function toSeconds(mm, ss, frac) {
  const fraction = frac.length === 2 ? Number(frac) / 100 : Number(frac) / 1000
  return Number(mm) * 60 + Number(ss) + fraction
}

// Shared by any lyrics source that only has line start times (e.g. embedded
// SYLT tags) so every source produces the same { startTime, endTime, text } shape.
export function withEndTimes(lines) {
  const sorted = [...lines].sort((a, b) => a.startTime - b.startTime)
  return sorted.map((line, i) => ({
    ...line,
    endTime: i + 1 < sorted.length ? sorted[i + 1].startTime : Infinity,
  }))
}

export function parseLrc(lrcText) {
  if (!lrcText) return null

  const cleaned = lrcText.replace(/^﻿/, "")
  const lines = []

  for (const rawLine of cleaned.split(/\r\n|\r|\n/)) {
    const match = rawLine.match(LINE_PATTERN)
    if (!match) continue

    const [, tagBlock, text] = match
    const trimmedText = text.trim()

    for (const tagMatch of tagBlock.matchAll(TIMESTAMP_TAGS)) {
      const [, mm, ss, frac] = tagMatch
      lines.push({ startTime: toSeconds(mm, ss, frac), text: trimmedText })
    }
  }

  if (lines.length === 0) return null

  const timestamps = withEndTimes(lines)

  return {
    timestamps,
    text: timestamps.map((t) => t.text).join("\n"),
    synchronized: true,
  }
}
