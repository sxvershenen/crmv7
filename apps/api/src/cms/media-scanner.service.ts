import { createHash } from "node:crypto"

import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { mediaError } from "./media-processing-error.js"

/** External scanner adapter. Unknown or unavailable verdicts fail closed. */
@Injectable()
export class MediaScannerService {
  private readonly driver: "disabled" | "http"
  private readonly url: string | null
  private readonly timeoutMs: number

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.driver = config.get<"disabled" | "http">("MEDIA_SCANNER_DRIVER", "disabled")
    this.url = config.get<string>("MEDIA_SCANNER_URL") ?? null
    this.timeoutMs = config.get<number>("MEDIA_SCANNER_TIMEOUT_MS", 5_000)
  }

  async scan(body: Buffer, mimeType: string) {
    if (this.driver === "disabled") return
    if (!this.url) throw mediaError("MEDIA_SCANNER_UNAVAILABLE", "External media scanner is not configured", true)

    let response: Response
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-media-mime-type": mimeType,
          "x-media-sha256": createHash("sha256").update(body).digest("hex"),
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw mediaError("MEDIA_SCANNER_UNAVAILABLE", "External media scanner did not respond", true)
    }

    const payload = await response.json().catch(() => null) as { verdict?: unknown; status?: unknown } | null
    const verdict = payload?.verdict ?? payload?.status
    if (response.ok && verdict === "clean") return
    if (response.ok && verdict === "infected") throw mediaError("MEDIA_MALWARE_DETECTED", "Файл заблокирован external security scan")
    throw mediaError("MEDIA_SCANNER_INVALID_RESPONSE", "External media scanner returned no trusted clean verdict", true)
  }
}
