export const BUSINESS_TIME_ZONE = "Europe/Moscow"

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/

/** Converts an API instant to the wall-clock value edited by CRM date/time fields. */
export function toBusinessDateTimeInput(value: string | null | undefined) {
  if (!value) return ""
  if (localDateTimePattern.test(value)) return value.slice(0, 16)
  const instant = new Date(value)
  if (!Number.isFinite(instant.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit",
    month: "2-digit", timeZone: BUSINESS_TIME_ZONE, year: "numeric",
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`
}

/** Moscow has used a fixed UTC+03 offset since 2014; API contracts store instants. */
export function businessDateTimeToIso(value: string | null | undefined) {
  if (!value) return ""
  const source = localDateTimePattern.test(value) ? `${value}+03:00` : value
  const instant = new Date(source)
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : value
}
