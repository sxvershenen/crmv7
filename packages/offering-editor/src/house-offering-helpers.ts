import {
  InternalCampgroundOfferingQuoteBodySchema,
  InternalHouseOfferingQuoteBodySchema,
  type InternalCampgroundOfferingQuoteBody,
  type InternalHouseOfferingQuoteBody,
} from "@crm/contracts"

import type { OfferingEditorCommandMeta } from "./gateway.js"

export type HouseQuoteCommandMeta = Pick<OfferingEditorCommandMeta, "operationId" | "idempotencyKey"> & Partial<Pick<OfferingEditorCommandMeta, "expectedPricingVersion">>

/** Build the normalized quote body. Pricing CAS is intentionally not a quote input. */
export function buildHouseQuoteBody({
  arrivalDate,
  currency,
  departureDate,
  guests,
  meta,
  ratePlanKey,
}: {
  arrivalDate: string
  currency: string
  departureDate: string
  guests: number
  meta: HouseQuoteCommandMeta
  ratePlanKey: string | null
}): InternalHouseOfferingQuoteBody {
  const quoteMeta = { idempotencyKey: meta.idempotencyKey, operationId: meta.operationId }
  const parsed = InternalHouseOfferingQuoteBodySchema.safeParse({
    addOns: [],
    currency,
    ...quoteMeta,
    period: { arrivalDate, departureDate, type: "stay" },
    quantities: { guests, participants: null, units: 1 },
    ratePlanKey,
  })
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "))
  return parsed.data
}

export function buildCampgroundQuoteBody({
  arrivalDate,
  currency,
  departureDate,
  meta,
  quantity,
  ratePlanKey,
  salesUnit,
}: {
  arrivalDate: string
  currency: string
  departureDate: string
  meta: HouseQuoteCommandMeta
  quantity: number
  ratePlanKey: string | null
  salesUnit: "owned_tent" | "own_tent_pitch"
}): InternalCampgroundOfferingQuoteBody {
  const quoteMeta = { idempotencyKey: meta.idempotencyKey, operationId: meta.operationId }
  const parsed = InternalCampgroundOfferingQuoteBodySchema.safeParse({
    addOns: [],
    currency,
    ...quoteMeta,
    period: { arrivalDate, departureDate, type: "stay" },
    quantities: salesUnit === "owned_tent"
      ? { guests: quantity, participants: null, units: 1 }
      : { guests: null, participants: null, units: quantity },
    ratePlanKey,
  })
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "))
  return parsed.data
}

/** Keeps one normalized request stable across a transport error/retry pair. */
export class HouseQuoteRequestCache<TBody = InternalHouseOfferingQuoteBody> {
  private current: { body: TBody; inputKey: string } | null = null

  getOrCreate(inputKey: string, create: () => TBody): TBody {
    if (this.current?.inputKey === inputKey) return this.current.body
    const body = create()
    this.current = { body, inputKey }
    return body
  }

  markSuccess(inputKey: string) {
    if (this.current?.inputKey === inputKey) this.current = null
  }

  reset() { this.current = null }
}

export function allowOfferingEditorClose(isDirty: boolean, confirm: () => boolean): boolean {
  return !isDirty || confirm()
}

export function canEditPricingDraft(canEditDraft: boolean, hasConflict: boolean): boolean {
  return canEditDraft && !hasConflict
}

export function shouldPreserveLocalPricingDraft(isDirty: boolean, hasConflict: boolean): boolean {
  return isDirty || hasConflict
}

export function majorMoneyToMinor(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export function minorMoneyToMajor(value: number): string {
  return (value / 100).toFixed(2)
}

/** Return today's service date in the offering's business timezone. */
export function serviceDateInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(now)
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Increment an ISO date without applying host-local DST or timezone rules. */
export function incrementDateOnly(value: string, days = 1): string {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Convert a wall-clock value entered for an offering timezone into one ISO instant. */
export function zonedLocalDateTimeToIso(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error("Укажите дату и время активации")
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const desired = {
    year: Number(yearText), month: Number(monthText), day: Number(dayText),
    hour: Number(hourText), minute: Number(minuteText),
  }
  const desiredUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)
  let candidate = desiredUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = zonedParts(new Date(candidate), timezone)
    const representedUtc = Date.UTC(represented.year, represented.month - 1, represented.day, represented.hour, represented.minute)
    const next = candidate + (desiredUtc - representedUtc)
    if (next === candidate) break
    candidate = next
  }
  const actual = zonedParts(new Date(candidate), timezone)
  if (Object.keys(desired).some((key) => desired[key as keyof typeof desired] !== actual[key as keyof typeof actual])) {
    throw new Error(`Такого локального времени нет в часовом поясе ${timezone}`)
  }
  return new Date(candidate).toISOString()
}

function zonedParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit",
    month: "2-digit", timeZone: timezone, year: "numeric",
  }).formatToParts(value)
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]))
  return { year: map.year ?? 0, month: map.month ?? 0, day: map.day ?? 0, hour: map.hour ?? 0, minute: map.minute ?? 0 }
}
