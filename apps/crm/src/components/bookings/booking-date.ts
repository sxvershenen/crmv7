const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" })

export function fromIso(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function toIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

export function shiftIso(value: string, amount: number) {
  const date = fromIso(value)
  date.setDate(date.getDate() + amount)
  return toIso(date)
}

export function formatDate(value: string) {
  return dateLabel.format(fromIso(value)).replace(" г.", "")
}

export function time(hour: number) {
  const minutes = Math.round(Math.max(0, Math.min(24, hour)) * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}
