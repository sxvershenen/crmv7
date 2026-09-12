/** API/storage money is integer minor units; CRM view models use major currency units. */
export function minorToMajor(amountMinor: number): number {
  return amountMinor / 100
}

export function majorToMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100)
}
