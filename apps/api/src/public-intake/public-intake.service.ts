import { createHash, randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common"
import { Brackets, DataSource, QueryFailedError, type EntityManager } from "typeorm"
import { z } from "zod"

import { PublicLeadIntakeResponseSchema, type PublicLeadIntake, type PublicLeadIntakeResponse } from "@crm/contracts"
import { ChangeLogEntity, CustomerEntity, IdempotencyKeyEntity, LeadEntity, OutboxEventEntity } from "@crm/db"
import { normalizePhone } from "@crm/domain"

type NormalizedIntake = Omit<PublicLeadIntake, "website" | "phone" | "email" | "name" | "message" | "attribution" | "consent"> & {
  name: string
  phone: string | null
  email: string | null
  message: string
  attribution: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null; referrer: string | null; landingPath: string }
  consent: { privacyAccepted: true; marketingAccepted: boolean; analyticsAccepted: boolean; policyVersion: string }
}

@Injectable()
export class PublicIntakeService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async submit(input: PublicLeadIntake, serverRequestId: string): Promise<PublicLeadIntakeResponse> {
    if (input.website?.trim()) return this.response(serverRequestId, new Date())
    const normalized = this.normalize(input)
    const requestHash = this.fingerprint(normalized)

    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "public-intake:lead"
      const replay = await this.replay(manager, scope, normalized.operationId, normalized.idempotencyKey, requestHash)
      if (replay) return replay

      const now = new Date()
      const consentCapturedAt = now.toISOString()
      const customer = await manager.save(manager.create(CustomerEntity, {
        id: randomUUID(), type: "person", name: normalized.name,
        phones: normalized.phone ? [normalized.phone] : [], channels: ["Сайт"], email: normalized.email,
        notes: "", consent: { processing: true, marketing: normalized.consent.marketingAccepted, updatedAt: consentCapturedAt },
        duplicateRisk: "none", assignees: [], leadCount: 1, activeLeadCount: 1, bookingCount: 0,
        futureBookingCount: 0, taskCount: 0, turnover: 0, debt: 0, nextContactAt: null, lastVisitAt: null,
        createdBy: null, updatedBy: null, archivedAt: null,
      }))
      const lead = await manager.save(manager.create(LeadEntity, {
        id: randomUUID(), customerId: customer.id, name: normalized.name, phone: normalized.phone,
        channel: "Сайт", direction: "Входящая", requestedItem: this.requestedItem(normalized),
        desiredStartAt: normalized.intent.startDate ? this.moscowDate(normalized.intent.startDate) : null,
        desiredEndAt: normalized.intent.endDate ? this.moscowDate(normalized.intent.endDate) : null,
        guestCount: normalized.intent.guests ?? 0, comment: normalized.message,
        source: normalized.attribution.source ?? "website", utm: this.utm(normalized, consentCapturedAt),
        assignees: [], nextContactAt: null, status: "new", createdBy: null, updatedBy: null, archivedAt: null,
      }))

      await this.recordCustomerCreated(manager, customer, normalized.operationId, serverRequestId, now)
      await this.recordLeadCreated(manager, lead, customer.id, normalized, serverRequestId, now)
      const response = this.response(serverRequestId, now)
      await manager.save(manager.create(IdempotencyKeyEntity, {
        id: randomUUID(), scope, operationId: normalized.operationId, idempotencyKey: normalized.idempotencyKey,
        requestHash, responseStatus: 202, responseBody: response, createdAt: now,
      }))
      return response
    }))
  }

  private normalize(input: PublicLeadIntake): NormalizedIntake {
    const phone = input.phone ? normalizePhone(input.phone) : null
    if (input.phone && (!phone || phone.length < 5 || phone.length > 15)) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { phone: ["Некорректный номер телефона"] }, details: {} })
    }
    const email = input.email ? this.clean(input.email, 320).toLocaleLowerCase("en-US") : null
    if (email && !z.string().email().max(320).safeParse(email).success) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { email: ["Некорректный адрес электронной почты"] }, details: {} })
    }
    const startDate = input.intent.startDate ? this.assertRealDate(input.intent.startDate, "intent.startDate") : null
    const endDate = input.intent.endDate ? this.assertRealDate(input.intent.endDate, "intent.endDate") : null
    if (startDate && endDate && startDate.getTime() >= endDate.getTime()) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { "intent.endDate": ["Дата окончания должна быть позже даты начала"] }, details: {} })
    }
    const referrer = input.attribution.referrer ? new URL(input.attribution.referrer) : null
    if (referrer) { referrer.username = ""; referrer.password = ""; referrer.search = ""; referrer.hash = "" }
    const landing = new URL(this.clean(input.attribution.landingPath, 2048), "https://public.invalid")
    if (landing.origin !== "https://public.invalid") throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { "attribution.landingPath": ["Некорректный локальный путь"] }, details: {} })
    return {
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      name: this.cleanRequired(input.name, 200, "name"),
      phone,
      email,
      message: input.message ? this.clean(input.message, 3000) : "",
      intent: input.intent,
      attribution: {
        source: this.cleanNullable(input.attribution.source, 200, true),
        medium: this.cleanNullable(input.attribution.medium, 200, true),
        campaign: this.cleanNullable(input.attribution.campaign, 200),
        content: this.cleanNullable(input.attribution.content, 200),
        term: this.cleanNullable(input.attribution.term, 200),
        referrer: referrer?.toString() ?? null,
        landingPath: landing.pathname,
      },
      consent: {
        privacyAccepted: true,
        marketingAccepted: input.consent.marketingAccepted,
        analyticsAccepted: input.consent.analyticsAccepted,
        policyVersion: this.cleanRequired(input.consent.policyVersion, 100, "consent.policyVersion"),
      },
    }
  }

  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<PublicLeadIntakeResponse | null> {
    for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock])
    }
    const stored = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key")
      .where("key.scope = :scope", { scope })
      .andWhere(new Brackets((query) => query.where("key.operation_id = :operationId", { operationId }).orWhere("key.idempotency_key = :idempotencyKey", { idempotencyKey })))
      .getOne()
    if (!stored) return null
    if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными", details: {} })
    }
    const parsed = PublicLeadIntakeResponseSchema.safeParse(stored.responseBody)
    if (!parsed.success) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Сохранённый результат операции недоступен", details: {} })
    return parsed.data
  }

  private async recordCustomerCreated(manager: EntityManager, customer: CustomerEntity, operationId: string, requestId: string, now: Date) {
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "customer", entityId: customer.id, action: "created", actorId: null, requestId, changes: { source: "public_intake", operationId }, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: "customer.created", aggregateType: "customer", aggregateId: customer.id, payload: { customerId: customer.id, version: customer.version, source: "public_intake" }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }

  private async recordLeadCreated(manager: EntityManager, lead: LeadEntity, customerId: string, input: NormalizedIntake, requestId: string, now: Date) {
    const crmDeepLink = `/leads/${lead.id}`
    const changes = { source: "public_intake", operationId: input.operationId, customerId, intent: { kind: input.intent.kind, publicEntityId: input.intent.publicEntityId ?? null }, crmDeepLink }
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "lead", entityId: lead.id, action: "created", actorId: null, requestId, changes, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: "lead.created", aggregateType: "lead", aggregateId: lead.id, payload: { leadId: lead.id, customerId, status: lead.status, version: lead.version, source: "public_intake", crmDeepLink }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }

  private utm(input: NormalizedIntake, consentCapturedAt: string): Record<string, string> {
    const values: Record<string, string | null> = {
      source: input.attribution.source, medium: input.attribution.medium, campaign: input.attribution.campaign,
      content: input.attribution.content, term: input.attribution.term, referrer: input.attribution.referrer,
      landingPath: input.attribution.landingPath, consentPolicyVersion: input.consent.policyVersion,
      consentCapturedAt, marketingAccepted: String(input.consent.marketingAccepted), analyticsAccepted: String(input.consent.analyticsAccepted),
    }
    return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== null))
  }

  private requestedItem(input: NormalizedIntake) {
    return input.intent.publicEntityId ? `${input.intent.kind}:${input.intent.publicEntityId}` : input.intent.kind
  }

  private response(requestId: string, now: Date): PublicLeadIntakeResponse {
    return PublicLeadIntakeResponseSchema.parse({ requestId, accepted: true, receivedAt: now.toISOString() })
  }

  private fingerprint(input: NormalizedIntake) {
    const payload = {
      name: input.name, phone: input.phone, email: input.email, message: input.message,
      intent: input.intent, attribution: input.attribution, consent: input.consent,
    }
    return createHash("sha256").update(this.stableStringify(payload)).digest("hex")
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(",")}]`
    if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`).join(",")}}`
    return JSON.stringify(value)
  }

  private clean(value: string, max: number) {
    return value.normalize("NFKC").replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/gu, " ").trim().slice(0, max)
  }

  private cleanNullable(value: string | null, max: number, lowercase = false) {
    if (value === null) return null
    const clean = this.clean(value, max)
    if (!clean) return null
    return lowercase ? clean.toLocaleLowerCase("en-US") : clean
  }

  private cleanRequired(value: string, max: number, field: string) {
    const clean = this.clean(value, max)
    if (!clean) throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { [field]: ["Поле не должно быть пустым"] }, details: {} })
    return clean
  }

  private moscowDate(date: string) { return new Date(`${date}T00:00:00+03:00`) }

  private assertRealDate(value: string, field: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте заполнение полей", fieldErrors: { [field]: ["Некорректная календарная дата"] }, details: {} })
    }
    return parsed
  }

  private async retrySerializable<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await work() }
      catch (error) {
        const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined
        if (attempt >= 2 || (code !== "40001" && code !== "40P01")) throw error
      }
    }
  }
}
