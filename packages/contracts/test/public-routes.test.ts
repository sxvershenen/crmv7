import { describe, expect, it } from "vitest"

import { canonicalPublicPath, publicReleasePathCandidates } from "../src/public-routes.js"

describe("public URL migration map", () => {
  it.each([
    ["/houses/forest", "/domiki/forest"],
    ["/campgrounds/pitches", "/kemping/pitches"],
    ["/addons/firewood", "/dopy/firewood"],
    ["/venues/meadow", "/poshadki/meadow"],
    ["/programs/rafting", "/programmy/rafting"],
    ["/events/corporate", "/meropriyatiya/corporate"],
    ["/resources/sauna-chan", "/dopy/sauna-chan"],
  ])("maps %s to %s", (legacy, canonical) => expect(canonicalPublicPath(legacy)).toBe(canonical))

  it("keeps the canonical URL first and emits direct legacy candidates without chains", () => {
    expect(publicReleasePathCandidates("/poshadki/meadow")).toEqual(["/poshadki/meadow", "/venues/meadow"])
  })
})
