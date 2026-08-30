import type { ProgramCategoryIcon, ProgramCategoryTone } from "@app/entities/programs"

export const programIconOptions: { value: ProgramCategoryIcon; label: string }[] = [
  { value: "campfire", label: "Костёр" },
  { value: "leaf", label: "Лист" },
  { value: "palette", label: "Творчество" },
  { value: "snowflake", label: "Снежинка" },
  { value: "sparkles", label: "Искры" },
]

export const programToneOptions: { value: ProgramCategoryTone; label: string }[] = [
  { value: "amber", label: "Янтарный" },
  { value: "emerald", label: "Зелёный" },
  { value: "violet", label: "Фиолетовый" },
  { value: "sky", label: "Голубой" },
  { value: "rose", label: "Розовый" },
]
