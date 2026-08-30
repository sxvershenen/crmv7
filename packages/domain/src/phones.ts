/**
 * Canonical comparison key for phone search and duplicate hints.
 * The original value stays in the entity for display; this function must not
 * be used to silently link records.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.normalize("NFKC").replace(/\D/gu, "")
  if (!digits) return null
  if (digits.length === 10) return `7${digits}`
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return `7${digits.slice(1)}`
  return digits
}

export function phonesEqual(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizePhone(left)
  return normalizedLeft !== null && normalizedLeft === normalizePhone(right)
}
