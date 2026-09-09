import { cn } from "@/lib/utils"
import { Progress } from "../ui/progress"

const money = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
})

type PaymentVisualState = "empty" | "full" | "partial" | "unpaid"

function getPaymentState(paid: number, total: number): PaymentVisualState {
  if (total <= 0) return "empty"
  if (paid <= 0) return "unpaid"
  if (paid >= total) return "full"
  return "partial"
}

export function PaymentProgress({
  className,
  paid,
  total,
}: {
  className?: string
  paid: number
  total: number
}) {
  const state = getPaymentState(paid, total)
  const safePaid = Math.max(0, paid)
  const safeTotal = Math.max(0, total)
  const value = state === "empty" ? 0 : Math.min(100, (safePaid / safeTotal) * 100)
  const label = state === "empty"
    ? "Сумма оплаты не указана"
    : `Оплачено ${money.format(safePaid)} из ${money.format(safeTotal)}`
  const paidLabel = money.format(safePaid)
  const totalLabel = safeTotal > 0 ? `из ${money.format(safeTotal)}` : "из —"

  return (
    <Progress
      aria-label={label}
      aria-valuemax={safeTotal > 0 ? safeTotal : 100}
      aria-valuemin={0}
      aria-valuenow={safeTotal > 0 ? Math.min(safePaid, safeTotal) : 0}
      aria-valuetext={label}
      className={cn(
        "min-w-20 gap-0 text-[10px] font-normal leading-[14px] tabular-nums",
        className,
      )}
      data-payment-state={state}
      value={value}
    >
      <span className="mb-1 flex items-center justify-between gap-2 text-foreground">
        <span>{paidLabel}</span>
        <span>{totalLabel}</span>
      </span>
    </Progress>
  )
}

export function PaymentSummary({
  className,
  paid,
  total,
}: {
  className?: string
  paid: number
  total: number
}) {
  return <PaymentProgress className={cn(className)} paid={paid} total={total} />
}
