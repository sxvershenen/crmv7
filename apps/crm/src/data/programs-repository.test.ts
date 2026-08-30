import { describe, expect, it, vi } from "vitest"

import type { ProgramQuery, ProgramsDataset } from "@app/entities/programs"
import { programCategoriesFixture, programRegistrationsFixture, programRunsFixture, programTemplatesFixture } from "@app/fixtures/programs"

import { ApiProgramsRepository, FixtureProgramsRepository, selectPrograms } from "./programs-repository"

const data: ProgramsDataset = {
  categories: programCategoriesFixture,
  registrations: programRegistrationsFixture,
  runs: programRunsFixture,
  templates: programTemplatesFixture,
}
const baseQuery: ProgramQuery = { category: "all", date: "2026-08-24", rangeEnd: "2026-08-30", section: "templates", sort: { direction: "asc", key: "name" }, status: "all" }

describe("ProgramsRepository fixture adapter", () => {
  it("filters templates by category and sorts useful numeric fields", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "children", sort: { direction: "desc", key: "price" } })
    expect(result.templates.map((item) => item.id)).toEqual(["clay-lab"])
  })

  it("keeps runs as separate dated entities and combines period, category and status", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "family", date: "2026-08-24", rangeEnd: "2026-08-25", section: "runs", sort: { direction: "asc", key: "date" }, status: "registration" })
    expect(result.runs.map((item) => item.id)).toEqual(["24081"])
    expect(result.runs[0]?.templateId).toBe("forest-family")
  })

  it("filters registrations through their run category", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "nature", section: "registrations", sort: { direction: "asc", key: "client" }, status: "cancelled" })
    expect(result.registrations.map((item) => item.id)).toEqual(["5004"])
  })

  it("persists generated fast status changes only inside repository fixture state", async () => {
    const repository = new FixtureProgramsRepository()
    await repository.updateRunStatus("25082", "registration")
    await repository.updateRegistrationStatus("5009", "confirmed")
    const result = await repository.list({ ...baseQuery, section: "runs", sort: { direction: "asc", key: "date" } })
    expect(result.runs.find((item) => item.id === "25082")?.status).toBe("registration")
    expect(result.registrations.find((item) => item.id === "5009")?.status).toBe("confirmed")
  })

  it("persists local assignment for each Programs entity through the repository boundary", async () => {
    const repository = new FixtureProgramsRepository()
    await repository.assignTemplate("winter-tale")
    await repository.assignRun("25082")
    await repository.assignRegistration("5009")
    const result = await repository.list(baseQuery)

    expect(result.templates.find((item) => item.id === "winter-tale")?.assignees[0]?.name).toBe("Марина Кириллова")
    expect(result.runs.find((item) => item.id === "25082")?.assignees[0]?.name).toBe("Марина Кириллова")
    expect(result.registrations.find((item) => item.id === "5009")?.assignees[0]?.name).toBe("Марина Кириллова")
  })

  it("keeps template stages and editor-only settings behind the repository boundary", async () => {
    const repository = new FixtureProgramsRepository()
    const template = await repository.getTemplate("forest-family")
    if (!template) throw new Error("Fixture template forest-family is missing")

    expect(template.relatedRuns.length).toBeGreaterThan(0)
    expect(template.stages.length).toBeGreaterThan(0)
    template.description = "Описание для редактора"
    template.stages.push({ id: "stage-test", name: "Сбор группы", durationMinutes: 20, comment: "" })
    template.name = "Семейный день — обновлён"
    await repository.saveTemplate(template)

    expect((await repository.getTemplate("forest-family"))?.stages.some((stage) => stage.name === "Сбор группы")).toBe(true)
    expect((await repository.list(baseQuery)).templates.find((item) => item.id === "forest-family")?.name).toBe("Семейный день — обновлён")
  })

  it("keeps run registrations and resource bookings behind the run editor boundary", async () => {
    const repository = new FixtureProgramsRepository()
    const run = await repository.getRun("24081")
    if (!run) throw new Error("Fixture run 24081 is missing")

    expect(run.registrations[0]?.clientName).toBe("Анна Ковалёва")
    expect(run.registrations[0]?.paid).toBe(12600)
    expect(run.resourceBookings.length).toBeGreaterThan(0)
    run.comment = "Комментарий редактора"
    run.resourceBookings.push({ id: "resource-test", resourceId: "house-pine", resourceName: "Дом «Сосна»", startAt: run.startsAt, endAt: run.endsAt, guestCount: 17 })
    run.name = "Семейный день — тест"
    await repository.saveRun(run)

    expect((await repository.getRun("24081"))?.resourceBookings.some((booking) => booking.id === "resource-test")).toBe(true)
    expect((await repository.list({ ...baseQuery, section: "runs", sort: { direction: "asc", key: "date" } })).runs.find((item) => item.id === "24081")?.name).toBe("Семейный день — тест")
  })

  it("persists registration details and payments without flattening them into list data", async () => {
    const repository = new FixtureProgramsRepository()
    const registration = await repository.getRegistration("5011")
    if (!registration) throw new Error("Fixture registration 5011 is missing")

    expect(registration.paid).toBe(2800)
    expect(registration.run?.id).toBe("24082")
    registration.participantCount = 2
    registration.participantNames = "Михаил, Анна"
    registration.paid = 3800
    registration.debt = 1800
    registration.payments.push({ amount: 1000, comment: "Доплата", date: "2026-08-24", id: "payment-test", kind: "payment", method: "card" })
    await repository.saveRegistration(registration)

    expect((await repository.getRegistration("5011"))?.payments.some((payment) => payment.comment === "Доплата")).toBe(true)
    const listed = (await repository.list({ ...baseQuery, section: "registrations", sort: { direction: "asc", key: "client" } })).registrations.find((item) => item.id === "5011")
    expect(listed?.debt).toBe(1800)
    expect(listed).not.toHaveProperty("payments")
  })

  it("persists category presentation and keeps related templates editor-only", async () => {
    const repository = new FixtureProgramsRepository()
    const category = await repository.getCategory("family")
    if (!category) throw new Error("Fixture category family is missing")
    expect(category.relatedTemplates).not.toHaveLength(0)
    category.name = "Семейный отдых"
    category.tone = "rose"
    await repository.saveCategory(category)
    expect((await repository.list(baseQuery)).categories.find((item) => item.id === "family")?.name).toBe("Семейный отдых")
    expect((await repository.list(baseQuery)).templates.find((item) => item.categoryId === "family")?.categoryTone).toBe("rose")
    expect((await repository.list(baseQuery)).categories[0]).not.toHaveProperty("relatedTemplates")
  })
})

describe("ProgramsRepository API adapter", () => {
  const capabilities = { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true, canAddPayment: true, canRefund: true }
  const template = { id: "template-1", version: 2, code: "PT-1", name: "Программа API", categoryId: "family", durationMinutes: 120, minimumParticipants: 1, participantLimit: 12, registrationCloseHours: 2, basePrice: { amountMinor: 420000, currency: "RUB" }, description: "", publication: "published", published: true, assigneeIds: [], stages: [], nextOccurrence: null, archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities: { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true } }
  const occurrence = { id: "occurrence-1", version: 3, code: "PO-1", templateId: "template-1", name: "Проведение API", startsAt: "2026-08-25T10:00:00.000Z", endsAt: "2026-08-25T12:00:00.000Z", participantLimit: 12, registrationLimit: 12, participantCount: 2, registrationCount: 1, revenue: { amountMinor: 840000, currency: "RUB" }, paid: { amountMinor: 420000, currency: "RUB" }, status: "open", comment: "", assigneeIds: [], archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities }
  const registration = { id: "registration-1", version: 1, code: "PR-1", occurrenceId: "occurrence-1", customerId: "customer-1", phone: "+7", participantCount: 2, participantNames: "", total: { amountMinor: 840000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, paid: { amountMinor: 420000, currency: "RUB" }, status: "new", promo: "", source: "", comment: "", archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities: { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canAddPayment: true, canRefund: true } }

  it("maps canonical pages to the UI dataset and sends versioned transitions", async () => {
    const post = vi.fn(async (_path: string, _body: unknown, schema: unknown) => schema === undefined ? occurrence : occurrence)
    const client = {
      get: vi.fn(async (path: string) => path === "/auth/session" ? { user: { id: "manager-1", name: "Manager", role: "manager", capabilities } } : occurrence),
      getWithMeta: vi.fn(async (path: string) => ({ data: path.includes("templates") ? { items: [template], nextCursor: null } : path.includes("occurrences") ? { items: [occurrence], nextCursor: null } : { items: [registration], nextCursor: null }, headers: new Headers(), status: 200 })),
      patch: vi.fn(async () => template),
      post,
    }
    const repository = new ApiProgramsRepository(client as never)
    const data = await repository.list({ ...baseQuery, section: "runs", sort: { key: "date", direction: "asc" } })
    expect(data.runs[0]).toMatchObject({ id: "occurrence-1", status: "registration", revenue: 8400, paid: 4200 })
    expect(data.registrations[0]).toMatchObject({ id: "registration-1", runId: "occurrence-1", total: 8400, debt: 4200 })
    await repository.updateRunStatus("occurrence-1", "completed")
    expect(post).toHaveBeenCalledWith(expect.stringContaining("/programs/occurrences/occurrence-1/transition"), expect.objectContaining({ version: 3, status: "completed", operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })
})
