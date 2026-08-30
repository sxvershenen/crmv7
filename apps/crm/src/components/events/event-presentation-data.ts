import type { EventCategoryIcon, EventCategoryTone } from "@app/entities/events"

export const eventIconOptions: { value: EventCategoryIcon; label: string }[] = [
  { value: "heart", label: "Сердце" },
  { value: "building", label: "Здание" },
  { value: "cake", label: "Праздник" },
  { value: "bus", label: "Выезд" },
]

export const eventToneOptions: { value: EventCategoryTone; label: string }[] = [
  { value: "rose", label: "Розовый" },
  { value: "violet", label: "Фиолетовый" },
  { value: "amber", label: "Янтарный" },
  { value: "sky", label: "Голубой" },
]
