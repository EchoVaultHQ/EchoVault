import { describe, it, expect } from "vitest"
import { parseVersion, isNewer } from "./updateCheck.js"

describe("parseVersion", () => {
  it("parses a plain semver string", () => {
    expect(parseVersion("2.3.0")).toEqual([2, 3, 0])
  })

  it("strips a leading v", () => {
    expect(parseVersion("v2.3.0")).toEqual([2, 3, 0])
  })

  it("strips pre-release/build suffixes", () => {
    expect(parseVersion("v2.3.0-beta")).toEqual([2, 3, 0])
    expect(parseVersion("2.3.0+build5")).toEqual([2, 3, 0])
  })

  it("defaults missing parts to 0", () => {
    expect(parseVersion("v2")).toEqual([2, 0, 0])
    expect(parseVersion("v2.3")).toEqual([2, 3, 0])
  })
})

describe("isNewer", () => {
  it("returns true when the major version is greater", () => {
    expect(isNewer([3, 0, 0], [2, 9, 9])).toBe(true)
  })

  it("returns true when major is equal but minor is greater", () => {
    expect(isNewer([2, 4, 0], [2, 3, 9])).toBe(true)
  })

  it("returns true when major/minor are equal but patch is greater", () => {
    expect(isNewer([2, 3, 1], [2, 3, 0])).toBe(true)
  })

  it("returns false when versions are equal", () => {
    expect(isNewer([2, 3, 0], [2, 3, 0])).toBe(false)
  })

  it("returns false when a is older than b", () => {
    expect(isNewer([2, 3, 0], [2, 4, 0])).toBe(false)
  })
})
