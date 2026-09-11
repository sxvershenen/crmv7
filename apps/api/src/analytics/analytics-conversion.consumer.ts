import { Inject, Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DataSource } from "typeorm"
import { z } from "zod"

import { DomainConversionFactSchema, IdSchema } from "@crm/contracts"

import { OUTBOX_CONSUMERS, PermanentDeliveryError, type ClaimedOutboxDelivery } from "../delivery/outbox-delivery.types.js"

const LeadCreatedPayloadSchema = z.object({ leadId: IdSchema }).passthrough()
const BookingCreatedPayloadSchema = z.object({ bookingId: IdSchema }).passthrough()
const PaymentChargePayloadSchema = z.object({ paymentId: IdSchema }).passthrough()

type ConversionKind = "lead_created" | "booking_created" | "payment_recorded"

@Injectable()
export class AnalyticsConversionConsumer {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async consume(claim: ClaimedOutboxDelivery): Promise<void> {
    if (claim.consumer !== OUTBOX_CONSUMERS.analytics) {
      throw new PermanentDeliveryError("INVALID_ANALYTICS_CONSUMER")
    }

    const mapped = this.map(claim)
    if (!mapped) return

    const fact = DomainConversionFactSchema.parse({
      id: randomUUID(),
      kind: mapped.kind,
      occurredAt: claim.occurredAt,
      entityId: mapped.entityId,
      leadId: mapped.leadId,
      bookingId: mapped.bookingId,
      anonymousVisitorId: null,
      sessionId: null,
      releaseId: null,
      pageNodeId: null,
      attributionModel: "unattributed",
    })

    await this.dataSource.query(`
      INSERT INTO analytics_conversion_facts (
        id, source_event_id, kind, occurred_at, entity_id, lead_id, booking_id,
        anonymous_visitor_id, session_id, release_id, page_node_id, attribution_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (source_event_id) DO NOTHING
    `, [
      fact.id,
      claim.eventId,
      fact.kind,
      fact.occurredAt,
      fact.entityId,
      fact.leadId,
      fact.bookingId,
      fact.anonymousVisitorId,
      fact.sessionId,
      fact.releaseId,
      fact.pageNodeId,
      fact.attributionModel,
    ])
  }

  private map(claim: ClaimedOutboxDelivery): {
    kind: ConversionKind
    entityId: string
    leadId: string | null
    bookingId: string | null
  } | null {
    try {
      if (claim.topic === "lead.created") {
        const { leadId } = LeadCreatedPayloadSchema.parse(claim.payload)
        if (claim.aggregateType !== "lead" || claim.aggregateId !== leadId) throw new Error("envelope mismatch")
        return { kind: "lead_created", entityId: leadId, leadId, bookingId: null }
      }
      if (claim.topic === "booking.created") {
        const { bookingId } = BookingCreatedPayloadSchema.parse(claim.payload)
        if (claim.aggregateType !== "booking" || claim.aggregateId !== bookingId) throw new Error("envelope mismatch")
        return { kind: "booking_created", entityId: bookingId, leadId: null, bookingId }
      }
      if (claim.topic === "payment.charge") {
        const { paymentId } = PaymentChargePayloadSchema.parse(claim.payload)
        if (!["booking", "event", "program_registration"].includes(claim.aggregateType)) throw new Error("envelope mismatch")
        return {
          kind: "payment_recorded",
          entityId: paymentId,
          leadId: null,
          bookingId: claim.aggregateType === "booking" ? IdSchema.parse(claim.aggregateId) : null,
        }
      }
      return null
    } catch {
      throw new PermanentDeliveryError(this.malformedCode(claim.topic))
    }
  }

  private malformedCode(topic: string): string {
    if (topic === "lead.created") return "ANALYTICS_LEAD_CREATED_PAYLOAD_INVALID"
    if (topic === "booking.created") return "ANALYTICS_BOOKING_CREATED_PAYLOAD_INVALID"
    if (topic === "payment.charge") return "ANALYTICS_PAYMENT_CHARGE_PAYLOAD_INVALID"
    return "ANALYTICS_CONVERSION_PAYLOAD_INVALID"
  }
}
