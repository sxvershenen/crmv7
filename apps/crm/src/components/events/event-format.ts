const dateTime = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const date = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "2-digit", month: "short" })
const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" })

export const formatEventDateTime = (value: string) => dateTime.format(new Date(value)).replace(",", "")
export const formatEventDate = (value: string) => date.format(new Date(value)).replace(",", "")
export const formatEventTime = (value: string) => time.format(new Date(value))
export const fromIso = (value: string) => new Date(`${value}T12:00:00`)
export const toIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
export function shiftIso(value: string, days: number) { const next = fromIso(value); next.setDate(next.getDate() + days); return toIso(next) }
