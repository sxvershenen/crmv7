import { z } from "zod"

export type CategoryFormValues = {
  description: string
  icon: string
  name: string
  tone: string
}

type CategoryFormRecord = CategoryFormValues & { id: string }

export function createCategoryFormSchema(iconValues: string[], toneValues: string[]) {
  const icons = new Set(iconValues)
  const tones = new Set(toneValues)

  return z.object({
    description: z.string(),
    icon: z.string().refine((value) => icons.has(value), "Выберите иконку из списка"),
    name: z.string().refine((value) => value.trim().length > 0, "Укажите название"),
    tone: z.string().refine((value) => tones.has(value), "Выберите цвет из списка"),
  })
}

export function toCategoryFormValues(record: CategoryFormRecord): CategoryFormValues {
  return {
    description: record.description,
    icon: record.icon,
    name: record.name,
    tone: record.tone,
  }
}

export function applyCategoryFormValues<T extends CategoryFormRecord>(record: T, values: CategoryFormValues): T {
  return { ...record, ...values }
}
