export const SITE_ACTIONS = [
  "navigate",
  "booking",
  "lead",
  "call",
  "external",
  "filter",
  "share",
  "privacy",
] as const

export type SiteAction = (typeof SITE_ACTIONS)[number]

const analyticsPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

export interface AnalyticsProps {
  analyticsId?: string | undefined
  analyticsAction?: SiteAction | undefined
}

export function isValidAnalyticsId(value: string): boolean {
  return analyticsPattern.test(value)
}

export function analyticsAttributes({ analyticsAction, analyticsId }: AnalyticsProps) {
  if (analyticsId && !isValidAnalyticsId(analyticsId)) {
    console.warn(`[site-ui] Invalid analyticsId: ${analyticsId}`)
  }

  return {
    ...(analyticsId ? { "data-analytics-id": analyticsId } : {}),
    ...(analyticsAction ? { "data-analytics-action": analyticsAction } : {}),
  }
}
