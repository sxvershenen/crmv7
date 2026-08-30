import "reflect-metadata"

import { randomUUID } from "node:crypto"

import {
  CustomerEntity,
  BookingEntity,
  BookingItemEntity,
  EventEntity,
  LeadEntity,
  ProgramOccurrenceEntity,
  ProgramTemplateEntity,
  PaymentEntity,
  ResourceAllocationEntity,
  ResourceEntity,
  TaskEntity,
  UserEntity,
} from "@crm/db"
import crmDataSource from "@crm/db/data-source"

import { hashPassword } from "../auth/password.js"

async function seed() {
  await crmDataSource.initialize()
  await crmDataSource.runMigrations()
  const users = crmDataSource.getRepository(UserEntity)
  let admin = await users.findOneBy({ email: "admin@svistoplyasovo.local" })
  if (!admin) {
    admin = users.create({
      id: randomUUID(), email: "admin@svistoplyasovo.local", displayName: "Администратор CRM",
      passwordHash: await hashPassword("change-me-in-local-env"), role: "admin", status: "active",
      createdBy: null, updatedBy: null, archivedAt: null,
    })
    admin = await users.save(admin)
  }

  const customers = crmDataSource.getRepository(CustomerEntity)
  let customer = await customers.findOneBy({ name: "Илья Воронцов" })
  if (!customer) {
    customer = await customers.save(customers.create({
      id: randomUUID(), type: "person", name: "Илья Воронцов", phones: ["+79214501240"],
      channels: ["phone"], email: "ilya@example.local", notes: "Демонстрационный клиент локального окружения.",
      consent: { channel: "phone", version: "local-seed-v1" }, duplicateRisk: "none",
      assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }],
      leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 1,
      turnover: 0, debt: 0, nextContactAt: new Date("2026-09-01T07:00:00.000Z"), lastVisitAt: null,
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const leads = crmDataSource.getRepository(LeadEntity)
  if (!await leads.findOneBy({ name: "Илья Воронцов", source: "Локальный seed" })) {
    await leads.save(leads.create({
      id: randomUUID(), customerId: customer.id, name: customer.name, phone: customer.phones[0] ?? null,
      channel: "phone", direction: "Проживание", requestedItem: "Дом «Сосна»",
      desiredStartAt: new Date("2026-09-05T09:00:00.000Z"), desiredEndAt: new Date("2026-09-07T09:00:00.000Z"),
      guestCount: 4, comment: "Уточнить состав гостей и время заезда.", source: "Локальный seed",
      utm: { source: "direct" }, assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }],
      nextContactAt: new Date("2026-09-01T07:00:00.000Z"), status: "new",
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  const customerLeadCount = await leads.countBy({ customerId: customer.id })
  const customerActiveLeadCount = await leads.createQueryBuilder("lead")
    .where("lead.customer_id = :customerId", { customerId: customer.id })
    .andWhere("lead.archived_at IS NULL")
    .andWhere("lead.status NOT IN (:...terminal)", { terminal: ["success", "rejected", "spam", "archived"] })
    .getCount()
  if (customer.leadCount !== customerLeadCount || customer.activeLeadCount !== customerActiveLeadCount) {
    customer.leadCount = customerLeadCount
    customer.activeLeadCount = customerActiveLeadCount
    customer.updatedBy = admin.id
    customer = await customers.save(customer)
  }

  const resources = crmDataSource.getRepository(ResourceEntity)
  let resource = await resources.findOneBy({ code: "HOUSE-PINE" })
  if (!resource) {
    resource = await resources.save(resources.create({
      id: randomUUID(), code: "HOUSE-PINE", kind: "house", name: "Дом «Сосна»",
      capacityMode: "fixed", capacityTotal: 6,
      settings: { address: "Свистоплясово", preparationMinutes: 60, localSeed: true },
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const templates = crmDataSource.getRepository(ProgramTemplateEntity)
  let template = await templates.findOneBy({ code: "PROGRAM-FAMILY" })
  if (!template) {
    template = await templates.save(templates.create({
      id: randomUUID(), code: "PROGRAM-FAMILY", name: "Семейный день", categoryId: null,
      durationMinutes: 120, minimumParticipants: 2, participantLimit: 16, registrationCloseHours: 12,
      basePriceAmount: 250000, currency: "RUB", description: "Демонстрационная программа локального окружения.",
      publication: "draft", assigneeIds: [admin.id], stages: [
        { id: randomUUID(), name: "Встреча", durationMinutes: 15, comment: "" },
        { id: randomUUID(), name: "Основная программа", durationMinutes: 105, comment: "" },
      ], createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const occurrences = crmDataSource.getRepository(ProgramOccurrenceEntity)
  if (!await occurrences.findOneBy({ code: "RUN-FAMILY-001" })) {
    await occurrences.save(occurrences.create({
      id: randomUUID(), code: "RUN-FAMILY-001", templateId: template.id, name: template.name,
      startsAt: new Date("2026-09-06T08:00:00.000Z"), endsAt: new Date("2026-09-06T10:00:00.000Z"),
      participantLimit: 16, registrationLimit: 16, status: "open", currency: "RUB",
      comment: "Демонстрационный запуск.", assigneeIds: [admin.id],
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const events = crmDataSource.getRepository(EventEntity)
  if (!await events.findOneBy({ code: "EVENT-001" })) {
    await events.save(events.create({
      id: randomUUID(), code: "EVENT-001", name: "Семейный праздник", categoryId: null, customerId: customer.id,
      phone: customer.phones[0] ?? "", startsAt: new Date("2026-09-12T09:00:00.000Z"), endsAt: new Date("2026-09-12T15:00:00.000Z"),
      guestCount: 12, totalAmount: 850000, paidAmount: 250000, currency: "RUB", status: "planning",
      comment: "Демонстрационное мероприятие.", requiresAction: true, assigneeIds: [admin.id],
      scenario: [{ id: randomUUID(), name: "Подготовка", durationMinutes: 60, comment: "" }],
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const bookings = crmDataSource.getRepository(BookingEntity)
  let booking = await bookings.findOneBy({ code: "BOOKING-LOCAL-001" })
  if (!booking) {
    booking = await bookings.save(bookings.create({
      id: randomUUID(), code: "BOOKING-LOCAL-001", customerId: customer.id, status: "confirmed", currency: "RUB",
      totalAmount: 480000, snapshot: {
        guestCount: 4, source: "Телефон", utm: "direct", promo: "Без промокода",
        assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }], note: "Демонстрационная бронь.",
      }, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const bookingItems = crmDataSource.getRepository(BookingItemEntity)
  let bookingItem = await bookingItems.findOneBy({ bookingId: booking.id })
  if (!bookingItem) {
    bookingItem = await bookingItems.save(bookingItems.create({
      id: randomUUID(), bookingId: booking.id, type: "accommodation", resourceId: resource.id,
      startAt: new Date("2026-09-05T09:00:00.000Z"), endAt: new Date("2026-09-07T09:00:00.000Z"),
      quantity: 1, priceAmount: 480000, discountAmount: 0, currency: "RUB", preparationMinutes: 60,
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const allocations = crmDataSource.getRepository(ResourceAllocationEntity)
  if (!await allocations.findOneBy({ sourceId: bookingItem.id, sourceType: "booking_item" })) {
    await allocations.save(allocations.create({
      id: randomUUID(), resourceId: resource.id, sourceType: "booking_item", sourceId: bookingItem.id,
      startAt: new Date("2026-09-05T08:00:00.000Z"), endAt: new Date("2026-09-07T09:00:00.000Z"),
      quantity: 1, capacityImpact: 1, exclusive: true, status: "active",
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const payments = crmDataSource.getRepository(PaymentEntity)
  if (!await payments.findOneBy({ bookingId: booking.id, kind: "charge" })) {
    await payments.save(payments.create({
      id: randomUUID(), operationId: randomUUID(), bookingId: booking.id, kind: "charge", amount: 240000,
      currency: "RUB", method: "card", sourcePaymentId: null, reason: "Предоплата локального seed",
      createdAt: new Date("2026-08-30T12:00:00.000Z"), createdBy: admin.id,
    }))
  }

  const bookingAggregates = await crmDataSource.query(`
    WITH booking_summary AS (
      SELECT booking.id, booking.status, booking.total_amount, max(item.end_at) AS end_at,
        COALESCE(sum(payment.amount) FILTER (WHERE payment.kind IN ('charge','adjustment')), 0)::integer
          - COALESCE(sum(payment.amount) FILTER (WHERE payment.kind = 'refund'), 0)::integer AS paid
      FROM bookings booking
      LEFT JOIN booking_items item ON item.booking_id = booking.id AND item.archived_at IS NULL
      LEFT JOIN payments payment ON payment.booking_id = booking.id
      WHERE booking.customer_id = $1 AND booking.archived_at IS NULL
      GROUP BY booking.id, booking.status, booking.total_amount
    )
    SELECT count(*)::integer AS booking_count,
      count(*) FILTER (WHERE end_at > now() AND status NOT IN ('cancelled','archived'))::integer AS future_booking_count,
      COALESCE(sum(paid), 0)::integer AS turnover,
      COALESCE(sum(GREATEST(0, total_amount - paid)), 0)::integer AS debt
    FROM booking_summary
  `, [customer.id]) as Array<{ booking_count: number; future_booking_count: number; turnover: number; debt: number }>
  const bookingSummary = bookingAggregates[0]
  if (bookingSummary) {
    customer.bookingCount = bookingSummary.booking_count
    customer.futureBookingCount = bookingSummary.future_booking_count
    customer.turnover = bookingSummary.turnover
    customer.debt = bookingSummary.debt
    customer.updatedBy = admin.id
    customer = await customers.save(customer)
  }

  const tasks = crmDataSource.getRepository(TaskEntity)
  if (!await tasks.findOneBy({ code: "T-184" })) {
    await tasks.save(tasks.create({
      id: randomUUID(), code: "T-184", title: "Уточнить финальный состав гостей",
      details: "Получить список взрослых и детей до подготовки домика.", status: "todo", priority: "high",
      dueAt: new Date("2026-08-24T08:00:00.000Z"), reminderMinutes: null,
      relation: { type: "booking", label: "Бронь #2051 · Дом «Озеро»", href: "/bookings/2051" },
      assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }], commentCount: 0,
      latestComment: null, blocked: false, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  await crmDataSource.destroy()
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
