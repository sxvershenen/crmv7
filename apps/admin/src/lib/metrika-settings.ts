const COUNTER_ID_PATTERN = /^\d{1,20}$/

export function extractMetrikaCounterId(value: string): string | null {
  const input = value.trim()
  if (COUNTER_ID_PATTERN.test(input)) return input

  const matches = [...input.matchAll(/(?:ym\s*\(\s*|\bid\s*:\s*|\/watch\/)(\d{1,20})/giu)].map((match) => match[1]).filter((id): id is string => Boolean(id))
  const unique = [...new Set(matches)]
  return unique.length === 1 ? unique[0]! : null
}

export function isMetrikaCounterId(value: string): boolean {
  return COUNTER_ID_PATTERN.test(value)
}
