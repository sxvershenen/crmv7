import { z } from "zod"

import { DateTimeSchema } from "./primitives.js"

/** Compact, read-only CMS overview assembled from authoritative database facts. */
export const CmsDashboardMetricSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
  detail: z.string().min(1).max(240),
  trend: z.string().min(1).max(80).optional(),
}).strict()
export type CmsDashboardMetric = z.infer<typeof CmsDashboardMetricSchema>

export const CmsDashboardAttentionSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(500),
  href: z.string().min(1).max(2048),
  tone: z.enum(["danger", "warning", "info"]),
}).strict()
export type CmsDashboardAttention = z.infer<typeof CmsDashboardAttentionSchema>

export const CmsDashboardActivitySchema = z.object({
  id: z.string().min(1).max(120),
  actor: z.string().min(1).max(200),
  action: z.string().min(1).max(200),
  target: z.string().min(1).max(240),
  when: DateTimeSchema,
  status: z.enum(["draft", "review", "scheduled", "published", "archived", "failed"]),
}).strict()
export type CmsDashboardActivity = z.infer<typeof CmsDashboardActivitySchema>

export const CmsDashboardFunnelSchema = z.object({
  visitors: z.number().int().nonnegative(),
  leads: z.number().int().nonnegative(),
  bookings: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
}).strict()
export type CmsDashboardFunnel = z.infer<typeof CmsDashboardFunnelSchema>

export const CmsDashboardSchema = z.object({
  productionRelease: z.string().min(1).nullable(),
  publishedAt: DateTimeSchema.nullable(),
  drafts: z.number().int().nonnegative(),
  queueHealthy: z.boolean(),
  metrics: z.array(CmsDashboardMetricSchema).length(4),
  attention: z.array(CmsDashboardAttentionSchema).max(20),
  activity: z.array(CmsDashboardActivitySchema).max(20),
  funnel: CmsDashboardFunnelSchema,
}).strict()
export type CmsDashboard = z.infer<typeof CmsDashboardSchema>

/** The endpoint returns the dashboard directly, without a generic envelope. */
export const CmsDashboardResponseSchema = CmsDashboardSchema
export type CmsDashboardResponse = CmsDashboard
