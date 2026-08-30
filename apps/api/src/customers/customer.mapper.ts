import type { SessionUser, CustomerDto } from "@crm/contracts"
import type { CustomerEntity } from "@crm/db"

export function customerCapabilities(actor: SessionUser) {
  return { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive }
}

export function toCustomerDto(customer: CustomerEntity, actor: SessionUser): CustomerDto {
  return {
    id: customer.id, version: customer.version, type: customer.type as CustomerDto["type"], name: customer.name,
    phones: customer.phones ?? [], phone: customer.phones?.[0] ?? null, channels: customer.channels ?? [], email: customer.email ?? null, notes: customer.notes ?? "",
    consent: { processing: Boolean(customer.consent?.processing), marketing: Boolean(customer.consent?.marketing), updatedAt: typeof customer.consent?.updatedAt === "string" ? customer.consent.updatedAt : null },
    duplicateRisk: customer.duplicateRisk as CustomerDto["duplicateRisk"], assignees: customer.assignees ?? [],
    leadCount: customer.leadCount ?? 0, activeLeadCount: customer.activeLeadCount ?? 0, bookingCount: customer.bookingCount ?? 0,
    futureBookingCount: customer.futureBookingCount ?? 0, taskCount: customer.taskCount ?? 0, turnover: customer.turnover ?? 0,
    debt: customer.debt ?? 0, nextContactAt: customer.nextContactAt?.toISOString() ?? null, lastVisitAt: customer.lastVisitAt?.toISOString() ?? null,
    archived: customer.archivedAt !== null, createdAt: customer.createdAt.toISOString(), updatedAt: customer.updatedAt.toISOString(), capabilities: customerCapabilities(actor),
  }
}
