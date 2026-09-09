import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { Brackets, DataSource, QueryFailedError, type EntityManager } from "typeorm"

import type { PaymentSummary, PaymentTarget, SessionUser } from "@crm/contracts"
import { BookingEntity, ChangeLogEntity, EventEntity, IdempotencyKeyEntity, OutboxEventEntity, PaymentEntity, ProgramRegistrationEntity } from "@crm/db"
import { calculatePaymentSummary } from "@crm/domain"

import type { PaymentDto, PaymentListQuery, PaymentOperationInput } from "./payments.contracts.js"

type TargetEntity = BookingEntity | EventEntity | ProgramRegistrationEntity

@Injectable()
export class PaymentsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: PaymentListQuery, actor: SessionUser): Promise<{ items: PaymentDto[]; nextCursor: string | null }> {
    this.assert(actor, "canViewFinance")
    const rows = await this.dataSource.getRepository(PaymentEntity).find({ where: this.targetWhere(query.target), order: { createdAt: "DESC", id: "DESC" }, take: query.limit + 1 })
    const page = rows.slice(0, query.limit)
    return { items: page.map((payment) => this.toDto(payment)), nextCursor: rows.length > query.limit ? page.at(-1)?.id ?? null : null }
  }

  async summary(target: PaymentTarget, actor: SessionUser): Promise<PaymentSummary> {
    this.assert(actor, "canViewFinance")
    const entity = await this.findTarget(this.dataSource.manager, target)
    return this.calculateSummary(this.dataSource.manager, target, entity)
  }

  async operate(input: PaymentOperationInput, actor: SessionUser, requestId: string): Promise<PaymentDto> {
    this.assert(actor, input.type === "refund" ? "canRefund" : "canAddPayment")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `payment:${input.target.type}:${input.target.id}`
      const requestHash = JSON.stringify(input)
      const existing = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("idempotency")
        .where("idempotency.scope = :scope", { scope })
        .andWhere(new Brackets((query) => query.where("idempotency.operation_id = :operationId", { operationId: input.operationId }).orWhere("idempotency.idempotency_key = :idempotencyKey", { idempotencyKey: input.idempotencyKey })))
        .getOne()
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "operationId уже использован с другими данными" })
        if (existing.responseBody) return existing.responseBody as unknown as PaymentDto
      }

      const target = await this.findTarget(manager, input.target, true)
      if (target.version !== input.expectedVersion) throw this.versionConflict(input.target, target)
      if (this.currency(target) !== input.amount.currency) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Валюта операции не совпадает с валютой цели" })

      let source: PaymentEntity | null = null
      if (input.type === "refund") {
        source = await manager.getRepository(PaymentEntity).findOne({ where: { id: input.sourcePaymentId! }, lock: { mode: "pessimistic_write" } })
        if (!source || !this.matchesTarget(source, input.target) || source.kind === "refund") throw new ConflictException({ code: "PAYMENT_SOURCE_INVALID", message: "Исходная операция возврата не найдена для этой цели" })
        const refunded = await manager.getRepository(PaymentEntity).createQueryBuilder("payment").select("COALESCE(SUM(payment.amount), 0)", "amount").where("payment.source_payment_id = :sourceId", { sourceId: source.id }).getRawOne<{ amount: string }>()
        if (Number(refunded?.amount ?? 0) + input.amount.amountMinor > source.amount) throw new ConflictException({ code: "REFUND_LIMIT_EXCEEDED", message: "Сумма возвратов превышает исходную оплату" })
      }

      const now = new Date()
      const payment = manager.create(PaymentEntity, {
        id: randomUUID(), operationId: input.operationId, ...this.targetColumns(input.target), kind: input.type,
        amount: input.amount.amountMinor, currency: input.amount.currency, method: input.method,
        sourcePaymentId: input.sourcePaymentId, reason: input.reason ?? "", createdAt: now, createdBy: actor.id,
      })
      const saved = await manager.save(payment)
      const result = await manager.createQueryBuilder().update(this.entityClass(input.target)).set({ updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: target.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(input.target, await this.findTarget(manager, input.target))
      const updated = await this.findTarget(manager, input.target)

      // Event and program-registration totals are a read model of the ledger,
      // never a client-supplied mutable balance.
      if (input.target.type !== "booking") {
        const summary = await this.calculateSummary(manager, input.target, updated)
        await manager.createQueryBuilder().update(this.entityClass(input.target)).set({ paidAmount: summary.charged.amountMinor - summary.refunded.amountMinor } as never).where("id = :id", { id: updated.id }).execute()
      }

      await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "payment", entityId: saved.id, action: input.type, actorId: actor.id, requestId, changes: { target: input.target, amount: saved.amount, sourcePaymentId: saved.sourcePaymentId }, createdAt: now }))
      await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `payment.${input.type}`, aggregateType: input.target.type, aggregateId: input.target.id, payload: { paymentId: saved.id, operationId: saved.operationId, targetVersion: updated.version + 1 }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
      const response = this.toDto(saved)
      await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId: input.operationId, idempotencyKey: input.idempotencyKey, requestHash, responseStatus: 201, responseBody: response, createdAt: now }))
      return response
    }))
  }

  private entityClass(target: PaymentTarget) { return target.type === "booking" ? BookingEntity : target.type === "event" ? EventEntity : ProgramRegistrationEntity }
  private targetWhere(target: PaymentTarget) { return target.type === "booking" ? { bookingId: target.id } : target.type === "event" ? { eventId: target.id } : { programRegistrationId: target.id } }
  private targetColumns(target: PaymentTarget) { return target.type === "booking" ? { bookingId: target.id, eventId: null, programRegistrationId: null } : target.type === "event" ? { bookingId: null, eventId: target.id, programRegistrationId: null } : { bookingId: null, eventId: null, programRegistrationId: target.id } }
  private matchesTarget(payment: PaymentEntity, target: PaymentTarget) { return target.type === "booking" ? payment.bookingId === target.id : target.type === "event" ? payment.eventId === target.id : payment.programRegistrationId === target.id }
  private toTarget(payment: PaymentEntity): PaymentTarget { if (payment.bookingId) return { type: "booking", id: payment.bookingId }; if (payment.eventId) return { type: "event", id: payment.eventId }; return { type: "program_registration", id: payment.programRegistrationId! } }
  private currency(target: TargetEntity) { return target.currency }
  private due(target: TargetEntity) { return target instanceof BookingEntity ? target.totalAmount : target.totalAmount }

  private async findTarget(manager: EntityManager, target: PaymentTarget, lock = false): Promise<TargetEntity> {
    const repository = manager.getRepository(this.entityClass(target))
    const row = await repository.findOne({ where: { id: target.id }, ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}) })
    if (!row) throw new NotFoundException({ code: `${target.type.toUpperCase()}_NOT_FOUND`, message: "Цель оплаты не найдена" })
    return row as TargetEntity
  }

  private async calculateSummary(manager: EntityManager, target: PaymentTarget, entity: TargetEntity): Promise<PaymentSummary> {
    const payments = await manager.getRepository(PaymentEntity).find({ where: this.targetWhere(target), order: { createdAt: "ASC", id: "ASC" } })
    const result = calculatePaymentSummary(
      { amountMinor: this.due(entity), currency: this.currency(entity) },
      payments.map((payment) => ({ type: payment.kind as "charge" | "refund" | "adjustment", amount: { amountMinor: payment.amount, currency: payment.currency }, operationId: payment.operationId })),
      false,
    )
    return { ...result, target }
  }

  private async retrySerializable<T>(operation: () => Promise<T>, remaining = 2): Promise<T> {
    try { return await operation() } catch (error) {
      const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined
      if (remaining > 0 && (code === "40001" || code === "40P01")) return this.retrySerializable(operation, remaining - 1)
      throw error
    }
  }

  private toDto(payment: PaymentEntity): PaymentDto { return { id: payment.id, target: this.toTarget(payment), operationId: payment.operationId, type: payment.kind as PaymentDto["type"], amount: { amountMinor: payment.amount, currency: payment.currency }, method: payment.method as PaymentDto["method"], reason: payment.reason || null, sourcePaymentId: payment.sourcePaymentId, createdAt: payment.createdAt.toISOString(), createdBy: payment.createdBy!, immutable: true, version: 1 } }
  private assert(actor: SessionUser, capability: keyof SessionUser["capabilities"]) { if (!actor.capabilities[capability]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private versionConflict(target: PaymentTarget, entity: TargetEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Цель оплаты была изменена другим сотрудником", details: { entityId: target.id, serverVersion: entity.version } }) }
}
