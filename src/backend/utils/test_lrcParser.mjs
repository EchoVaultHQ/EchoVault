import assert from "node:assert/strict"
import { parseLrc } from "./lrcParser.js"

// single timestamp line -> last line's endTime is Infinity
{
  const result = parseLrc("[00:12.00]Hello world")
  assert.deepEqual(result.timestamps, [
    { startTime: 12, text: "Hello world", endTime: Infinity },
  ])
  assert.equal(result.synchronized, true)
}

// multi-timestamp line -> endTime computed from next entry's startTime
{
  const result = parseLrc("[00:12.00][00:45.00]Hello world")
  assert.deepEqual(result.timestamps, [
    { startTime: 12, text: "Hello world", endTime: 45 },
    { startTime: 45, text: "Hello world", endTime: Infinity },
  ])
}

// metadata-only file -> null
{
  const result = parseLrc("[ar:Some Artist]\n[ti:Some Title]\n[by:Someone]")
  assert.equal(result, null)
}

// BOM-prefixed file
{
  const result = parseLrc("﻿[00:01.500]First line\n[00:03.250]Second line")
  assert.deepEqual(result.timestamps, [
    { startTime: 1.5, text: "First line", endTime: 3.25 },
    { startTime: 3.25, text: "Second line", endTime: Infinity },
  ])
}

console.log("lrcParser self-check passed")
