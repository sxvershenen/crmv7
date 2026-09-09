import { z } from "zod";
import { DateTimeSchema, IdSchema } from "./primitives.js";
import { CapabilitiesSchema } from "./capabilities.js";

export const RoleSchema = z.enum(["admin", "manager", "lead_manager", "manager_supervisor", "supervisor", "technical_admin", "readonly"]);
export type Role = z.infer<typeof RoleSchema>;

export const LoginInputSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
}).strict();
export type LoginInput = z.infer<typeof LoginInputSchema>;
/** Alias used by the API layer; LoginInputSchema remains the canonical name. */
export const LoginRequestSchema = LoginInputSchema;
export type LoginRequest = LoginInput;

export const SessionUserSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(200),
  role: RoleSchema,
  capabilities: CapabilitiesSchema,
  displayName: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  roles: z.array(RoleSchema).min(1).max(8).optional(),
  blockedAt: DateTimeSchema.nullable().optional(),
}).strict();
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const AuthUserResponseSchema = z.object({
  user: SessionUserSchema,
}).strict();
export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;

export const OkResponseSchema = z.object({
  ok: z.literal(true),
}).strict();
export type OkResponse = z.infer<typeof OkResponseSchema>;

export const SessionSchema = z.object({
  user: SessionUserSchema,
  expiresAt: DateTimeSchema,
  issuedAt: DateTimeSchema,
}).strict();
export type Session = z.infer<typeof SessionSchema>;

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(12).max(1024),
}).strict();
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
