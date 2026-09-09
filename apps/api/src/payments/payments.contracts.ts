import { z } from "zod"
import { PaymentListQuerySchema, PaymentOperationSchema, PaymentSummaryQuerySchema } from "@crm/contracts"

/** Express uses the simple query parser, so bracket keys arrive unexpanded. */
function canonicalTargetQuery(value: unknown) {
  if (!value || typeof value !== "object") return value
  const query = value as Record<string, unknown>
  if (query.target && typeof query.target === "object") return query
  const type = query["target[type]"]
  const id = query["target[id]"]
  if (!type || !id) return query
  const rest = { ...query }
  delete rest["target[type]"]
  delete rest["target[id]"]
  return { ...rest, target: { type, id } }
}

export const PaymentListHttpQuerySchema = z.preprocess(canonicalTargetQuery, PaymentListQuerySchema)
export const PaymentSummaryHttpQuerySchema = z.preprocess(canonicalTargetQuery, PaymentSummaryQuerySchema)
export const PaymentOperationInputSchema = PaymentOperationSchema

export type {
  PaymentDto,
  PaymentListQuery,
  PaymentOperation as PaymentOperationInput,
  PaymentSummaryQuery,
} from "@crm/contracts"
