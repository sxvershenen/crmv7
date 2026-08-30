import { DomainError } from "./errors.js";

export interface Money { readonly amountMinor: number; readonly currency: string; }
export interface PaymentOperation { readonly type: "charge" | "refund" | "adjustment"; readonly amount: Money; readonly operationId: string; }
export type PaymentState = "unpaid" | "partial" | "paid" | "overpaid" | "refund" | "debt";
export interface PaymentSummary { readonly currency: string; readonly totalDue: Money; readonly charged: Money; readonly refunded: Money; readonly balance: number; readonly state: PaymentState; }

function assertMoney(value: Money): void {
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0 || !/^[A-Z]{3}$/.test(value.currency)) throw new DomainError("INVALID_MONEY", "Money must use a non-negative integer minor amount and ISO currency");
}
function sameCurrency(left: Money, right: Money): void { if (left.currency !== right.currency) throw new DomainError("CURRENCY_MISMATCH", "Money currencies must match"); }
export function addMoney(left: Money, right: Money): Money { assertMoney(left); assertMoney(right); sameCurrency(left, right); const amount = left.amountMinor + right.amountMinor; if (!Number.isSafeInteger(amount)) throw new DomainError("INVALID_MONEY", "Money result is outside safe integer range"); return { amountMinor: amount, currency: left.currency }; }
export function subtractMoney(left: Money, right: Money): Money { assertMoney(left); assertMoney(right); sameCurrency(left, right); const amount = left.amountMinor - right.amountMinor; if (!Number.isSafeInteger(amount)) throw new DomainError("INVALID_MONEY", "Money result is outside safe integer range"); return { amountMinor: amount, currency: left.currency }; }
export function calculatePaymentSummary(totalDue: Money, operations: readonly PaymentOperation[], debt = false): PaymentSummary {
  assertMoney(totalDue);
  let charged = 0; let refunded = 0;
  const operationIds = new Set<string>();
  for (const operation of operations) {
    assertMoney(operation.amount); sameCurrency(totalDue, operation.amount);
    if (!operation.operationId || operationIds.has(operation.operationId)) throw new DomainError("PAYMENT_INVALID", "Payment operation IDs must be unique");
    operationIds.add(operation.operationId);
    if (operation.amount.amountMinor <= 0) throw new DomainError("PAYMENT_INVALID", "Payment operation amount must be positive");
    if (operation.type === "charge" || operation.type === "adjustment") charged += operation.amount.amountMinor;
    else refunded += operation.amount.amountMinor;
  }
  if (refunded > charged) throw new DomainError("PAYMENT_INVALID", "Refund cannot exceed charged amount");
  const net = charged - refunded; const balance = totalDue.amountMinor - net;
  const state: PaymentState = debt ? "debt" : refunded > 0 && net === 0 ? "refund" : net === 0 ? "unpaid" : net < totalDue.amountMinor ? "partial" : net === totalDue.amountMinor ? "paid" : "overpaid";
  return { currency: totalDue.currency, totalDue: { ...totalDue }, charged: { amountMinor: charged, currency: totalDue.currency }, refunded: { amountMinor: refunded, currency: totalDue.currency }, balance, state };
}

export function assertImmutablePaymentMutation(existing: PaymentOperation, next: PaymentOperation): void {
  if (existing.operationId === next.operationId && (existing.type !== next.type || existing.amount.amountMinor !== next.amount.amountMinor || existing.amount.currency !== next.amount.currency)) throw new DomainError("PAYMENT_IMMUTABLE", "A recorded payment operation is immutable");
}
