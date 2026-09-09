/**
 * Named compatibility entrypoint for the generic public UI kit that predates
 * the approved homepage compositions. Keep this surface available for legacy
 * managed pages while new work imports canonical components from the package root.
 */
export * from "./lib/analytics"
export * from "./components/primitives"
export * from "./components/overlays"
export * from "./components/feedback"
export * from "./components/media"
export * from "./components/cards"
export * from "./components/listing"
export * from "./components/profile"
export * from "./components/booking"

export const SITE_UI_LEGACY_VERSION = "site-ui@1" as const
