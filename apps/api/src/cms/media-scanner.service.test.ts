import { afterEach, describe, expect, it, vi } from "vitest"

import { MediaScannerService } from "./media-scanner.service.js"

function config(values: Record<string, unknown>) {
  return { get: <T>(key: string, fallback?: T) => (values[key] === undefined ? fallback : values[key]) } as never
}

describe("MediaScannerService", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("requires an explicit clean verdict from the HTTP scanner", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verdict: "clean" }), { status: 200 }))
    vi.stubGlobal("fetch", fetch)
    const service = new MediaScannerService(config({ MEDIA_SCANNER_DRIVER: "http", MEDIA_SCANNER_URL: "https://scanner.test/scan", MEDIA_SCANNER_TIMEOUT_MS: 1000 }))

    await expect(service.scan(Buffer.from("payload"), "image/png")).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith("https://scanner.test/scan", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-media-mime-type": "image/png" }) }))
  })

  it("fails permanently on an infected verdict and retries scanner outages", async () => {
    const infectedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ verdict: "infected" }), { status: 200 }))
    vi.stubGlobal("fetch", infectedFetch)
    const infected = new MediaScannerService(config({ MEDIA_SCANNER_DRIVER: "http", MEDIA_SCANNER_URL: "https://scanner.test/scan" }))
    await expect(infected.scan(Buffer.from("payload"), "image/png")).rejects.toMatchObject({ code: "MEDIA_MALWARE_DETECTED", retryable: false })

    const unavailableFetch = vi.fn().mockRejectedValue(new Error("offline"))
    vi.stubGlobal("fetch", unavailableFetch)
    const unavailable = new MediaScannerService(config({ MEDIA_SCANNER_DRIVER: "http", MEDIA_SCANNER_URL: "https://scanner.test/scan" }))
    await expect(unavailable.scan(Buffer.from("payload"), "image/png")).rejects.toMatchObject({ code: "MEDIA_SCANNER_UNAVAILABLE", retryable: true })
  })

  it("does not silently bypass a disabled development adapter into a network call", async () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const service = new MediaScannerService(config({ MEDIA_SCANNER_DRIVER: "disabled" }))
    await expect(service.scan(Buffer.from("payload"), "image/png")).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})
