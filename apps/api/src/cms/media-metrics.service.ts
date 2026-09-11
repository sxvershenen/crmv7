import { Injectable } from "@nestjs/common"

export const mediaMetricNames = [
  "uploadsAccepted",
  "uploadsReady",
  "uploadsFailed",
  "processingRetries",
  "processingDeadLetters",
  "scannerFailures",
  "cleanupDeletedObjects",
  "cleanupFailures",
] as const

export type MediaMetricName = typeof mediaMetricNames[number]
export type MediaMetricSnapshot = Record<MediaMetricName, number>

@Injectable()
export class MediaMetricsService {
  private readonly values: MediaMetricSnapshot = Object.fromEntries(mediaMetricNames.map((name) => [name, 0])) as MediaMetricSnapshot

  increment(name: MediaMetricName, amount = 1) {
    this.values[name] += amount
  }

  snapshot(): MediaMetricSnapshot {
    return { ...this.values }
  }
}
