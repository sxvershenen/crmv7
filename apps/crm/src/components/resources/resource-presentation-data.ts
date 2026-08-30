import type { ResourceColorKey } from "@app/entities/resources"

export const resourceIconOptions = [
  { value: "cottage", label: "Дом" },
  { value: "home", label: "Дом с контуром" },
  { value: "bath", label: "Баня" },
  { value: "flame", label: "Огонь" },
  { value: "map", label: "Площадка" },
  { value: "trees", label: "Лес" },
  { value: "tent", label: "Палатка" },
]

export const resourceColorOptions: { value: ResourceColorKey; label: string }[] = [
  { value: "blue", label: "Синий" },
  { value: "orange", label: "Оранжевый" },
  { value: "violet", label: "Фиолетовый" },
  { value: "green", label: "Зелёный" },
  { value: "rose", label: "Розовый" },
  { value: "amber", label: "Янтарный" },
  { value: "sky", label: "Голубой" },
  { value: "slate", label: "Графитовый" },
]
