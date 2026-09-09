export function formatPercentOf(value: number, base: number): string {
  return base > 0 ? `${((value / base) * 100).toFixed(1)}%` : "—"
}
