const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "2-digit", month: "short" })
const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" })

export function formatProgramDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value)).replace(",", "")
}

export function formatProgramDate(value: string) {
  return dateFormatter.format(new Date(value)).replace(",", "")
}

export function formatProgramTime(value: string) {
  return timeFormatter.format(new Date(value))
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

export function fromIso(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function toIso(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function shiftIso(value: string, days: number) {
  const date = fromIso(value)
  date.setDate(date.getDate() + days)
  return toIso(date)
}
