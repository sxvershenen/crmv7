import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { Brackets, DataSource, QueryFailedError, type EntityManager } from "typeorm"

import type { PaymentSummary, SessionUser } from "@crm/contracts"
import { BookingEntity, ChangeLogEntity, IdempotencyKeyEntity, OutboxEventEntity, PaymentEntity } from "@crm/db"
import { calculatePaymentSummary } from "@crm/domain"

import type { PaymentDto, PaymentListQuery, PaymentOperationInput } from "./payments.contracts.js"

@Injectable()
export class PaymentsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: PaymentListQuery, actor: SessionUser): Promise<PaymentDto[]> {
    this.assert(actor, "canViewFinance")
    const payments = await this.dataSource.getRepository(PaymentEntity).find({ where: { bookingId: query.bookingId }, order: { createdAt: "DESC" }, take: query.limit })
    return payments.map(this.toDto)
  }

  async summary(bookingId: string, actor: SessionUser): Promise<PaymentSummary> {
    this.assert(actor, "canViewFinance")
    const booking = await this.findBooking(this.dataSource.manager, bookingId)
    return this.calculateSummary(this.dataSource.manager, booking)
  }

  async operate(input: PaymentOperationInput, actor: SessionUser, requestId: string): Promise<PaymentDto> {
    this.assert(actor, input.type === "refund" ? "canRefund" : "canAddPayment")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `payment:${input.bookingId}`
      const requestHash = JSON.stringify(input)
      const existing = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("idempotency")
        .where("idempotency.scope = :scope", { scope })
        .andWhere(new Brackets((query) => query.where("idempotency.operation_id = :operationId", { operationId: input.operationId }).orWhere("idempotency.idempotency_key = :idempotencyKey", { idempotencyKey: input.idempotencyKey })))
        .getOne()
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "operationId уже использован с другими данными" })
        if (existing.responseBody) return existing.responseBody as unknown as PaymentDto
      }
      const booking = await manager.getRepository(BookingEntity).findOne({ where: { id: input.bookingId }, lock: { mode: "pessimistic_write" } })
      if (!booking) throw new NotFoundException({ code: "BOOKING_NOT_FOUND", message: "Бронь не найдена" })
      if (booking.version !== input.expectedVersion) throw this.versionConflict(booking)
      if (booking.currency !== input.amount.currency) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Валюта операции не совпадает с валютой брони" })
      let source: PaymentEntity | null = null
      if (input.type === "refund") {
        source = await manager.getRepository(PaymentEntity).findOne({ where: { id: input.sourcePaymentId! }, lock: { mode: "pessimistic_write" } })
        if (!source || source.bookingId !== booking.id || source.kind === "refund") throw new ConflictException({ code: "PAYMENT_SOURCE_INVALID", message: "Исходная операция возврата не найдена" })
        const refunded = await manager.getRepository(PaymentEntity).createQueryBuilder("payment").select("COALESCE(SUM(payment.amount), 0)", "amount").where("payment.source_payment_id = :sourceId", { sourceId: source.id }).getRawOne<{ amount: string }>()
        if (Number(refunded?.amount ?? 0) + input.amount.amountMinor > source.amount) throw new ConflictException({ code: "REFUND_LIMIT_EXCEEDED", message: "Сумма возвратов превышает исходную оплату" })
      }
      const now = new Date()
      const payment = manager.create(PaymentEntity)
      Object.assign(payment, {
        id: randomUUID(), operationId: input.operationId, bookingId: booking.id, kind: input.type, amount: input.amount.amountMinor,
        currency: input.amount.currency, method: input.method, sourcePaymentId: input.sourcePaymentId, reason: input.reason ?? "", createdAt: now, createdBy: actor.id,
      })
      const saved = await manager.save(payment)
      const result = await manager.createQueryBuilder().update(BookingEntity).set({ updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: booking.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: booking.id }))
      const updatedBooking = await manager.findOneByOrFail(BookingEntity, { id: booking.id })
      await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "payment", entityId: saved.id, action: input.type, actorId: actor.id, requestId, changes: { bookingId: booking.id, amount: saved.amount, sourcePaymentId: saved.sourcePaymentId }, createdAt: now }))
      await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `payment.${input.type}`, aggregateType: "booking", aggregateId: booking.id, payload: { paymentId: saved.id, operationId: saved.operationId, bookingVersion: updatedBooking.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
      const response = this.toDto(saved)
      await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId: input.operationId, idempotencyKey: input.idempotencyKey, requestHash, responseStatus: 201, responseBody: response, createdAt: now }))
      return response
    }))
  }

  private async findBooking(manager: EntityManager, bookingId: string) {
    const booking = await manager.getRepository(BookingEntity).findOneBy({ id: bookingId })
    if (!booking) throw new NotFoundException({ code: "BOOKING_NOT_FOUND", message: "Бронь не найдена" })
    return booking
  }

  private async calculateSummary(manager: EntityManager, booking: BookingEntity): Promise<PaymentSummary> {
    const payments = await manager.getRepository(PaymentEntity).find({ where: { bookingId: booking.id }, order: { createdAt: "ASC" } })
    return calculatePaymentSummary(
      { amountMinor: booking.totalAmount, currency: booking.currency },
      payments.map((payment) => ({
        type: payment.kind as "charge" | "refund" | "adjustment",
        amount: { amountMinor: payment.amount, currency: payment.currency },
        operationId: payment.operationId,
      })),
      booking.snapshot.debt === true,
    )
  }

  private async retrySerializable<T>(operation: () => Promise<T>, remaining = 2): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined
      if (remaining > 0 && (code === "40001" || code === "40P01")) return this.retrySerializable(operation, remaining - 1)
      throw error
    }
  }

  private toDto = (payment: PaymentEntity): PaymentDto => ({ id: payment.id, bookingId: payment.bookingId, operationId: payment.operationId, type: payment.kind as PaymentDto["type"], amount: { amountMinor: payment.amount, currency: payment.currency }, method: payment.method as PaymentDto["method"], reason: payment.reason || null, sourcePaymentId: payment.sourcePaymentId, createdAt: payment.createdAt.toISOString(), createdBy: payment.createdBy!, immutable: true, version: 1 })
  private assert(actor: SessionUser, capability: keyof SessionUser["capabilities"]) { if (!actor.capabilities[capability]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private versionConflict(booking: BookingEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Бронь была изменена другим сотрудником", details: { entityId: booking.id, serverVersion: booking.version } }) }
}
