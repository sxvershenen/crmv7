import { DomainError } from "./errors.js";

export type Role = "admin" | "manager" | "lead_manager" | "manager_supervisor" | "supervisor" | "technical_admin" | "readonly";
export type Capability = "canView" | "canCreate" | "canEdit" | "canDelete" | "canArchive" | "canAssign" | "canChangeStatus" | "canAddPayment" | "canRefund" | "canOverrideConflict" | "canViewFinance" | "canViewAudit" | "canManageUsers" | "canManageSettings";
export type Capabilities = Readonly<Record<Capability, boolean>>;

const all: Capabilities = { canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true, canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true, canViewFinance: true, canViewAudit: true, canManageUsers: true, canManageSettings: true };
const noneExceptView: Capabilities = { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false, canAssign: false, canChangeStatus: false, canAddPayment: false, canRefund: false, canOverrideConflict: false, canViewFinance: false, canViewAudit: false, canManageUsers: false, canManageSettings: false };
export const roleCapabilitiesByRole: Readonly<Record<Role, Capabilities>> = {
  admin: all,
  manager: { ...all, canDelete: false, canManageUsers: false, canManageSettings: false },
  lead_manager: { ...all, canDelete: false, canAddPayment: false, canRefund: false, canOverrideConflict: false, canManageUsers: false, canManageSettings: false },
  manager_supervisor: { ...all, canDelete: false, canManageUsers: false, canManageSettings: false },
  supervisor: { ...all, canDelete: false, canManageUsers: false, canManageSettings: false },
  technical_admin: { ...noneExceptView, canManageUsers: true, canManageSettings: true, canViewAudit: true },
  readonly: noneExceptView,
};

/** Resolve one role; use capabilitiesForRoles when a user has multiple roles. */
export function roleCapabilities(role: Role): Capabilities {
  const resolved = roleCapabilitiesByRole[role];
  if (!resolved) throw new DomainError("PERMISSION_DENIED", "Unknown role cannot receive capabilities");
  return resolved;
}

export function capabilitiesForRoles(roles: readonly Role[]): Capabilities {
  return roles.reduce<Capabilities>((result, role) => {
    const roleSet = roleCapabilitiesByRole[role];
    if (!roleSet) return result;
    return Object.fromEntries(Object.keys(result).map((key) => [key, result[key as Capability] || roleSet[key as Capability]])) as Capabilities;
  }, { ...noneExceptView });
}

export function hasCapability(capabilities: Capabilities, capability: Capability): boolean { return capabilities[capability] === true; }
export function assertCapability(capabilities: Capabilities, capability: Capability): void {
  if (!hasCapability(capabilities, capability)) throw new DomainError("PERMISSION_DENIED", `Capability ${capability} is required`);
}
