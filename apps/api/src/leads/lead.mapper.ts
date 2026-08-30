import type { LeadDto, SessionUser } from "@crm/contracts"
import type { LeadEntity } from "@crm/db"

export function leadCapabilities(actor: SessionUser) {
  return { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive, canChangeStatus: actor.capabilities.canChangeStatus }
}

export function toLeadDto(lead: LeadEntity, actor: SessionUser): LeadDto {
  return {
    id: lead.id, version: lead.version, customerId: lead.customerId, name: lead.name, phone: lead.phone, channel: lead.channel,
    direction: lead.direction, requestedItem: lead.requestedItem, desiredStartAt: lead.desiredStartAt?.toISOString() ?? null,
    desiredEndAt: lead.desiredEndAt?.toISOString() ?? null, guestCount: lead.guestCount ?? 0, comment: lead.comment ?? "", source: lead.source,
    utm: lead.utm ?? {}, assignees: lead.assignees ?? [], nextContactAt: lead.nextContactAt?.toISOString() ?? null,
    status: lead.status as LeadDto["status"], archived: lead.archivedAt !== null,
    createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString(), capabilities: leadCapabilities(actor),
  }
}
