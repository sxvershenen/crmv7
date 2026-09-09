import { describe, expect, it, vi } from "vitest"

import { ApiEventsRepository } from "./events-repository"
import { ApiProgramsRepository } from "./programs-repository"

const capabilities = { canView: true, canCreate: true, canEdit: true, canArchive: true }
const programDetail = { id: "11111111-1111-4111-8111-111111111111", version: 2, name: "Семейные", description: "Для групп", icon: "campfire", tone: "amber", templateCount: 1, archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities, relatedTemplates: [{ id: "22222222-2222-4222-8222-222222222222", name: "Семейный день", version: 1, updatedAt: "2026-08-24T08:00:00.000Z", nextRun: null }] }
const eventDetail = { id: "33333333-3333-4333-8333-333333333333", version: 3, name: "Свадьба", description: "Праздники", icon: "heart", tone: "rose", eventCount: 1, archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities, relatedEvents: [{ id: "44444444-4444-4444-8444-444444444444", name: "Свадьба Анны", startsAt: "2026-08-25T10:00:00.000Z", clientName: "Анна" }] }

describe("category API repositories", () => {
  it("loads and version-patches program categories with related templates", async () => {
    const patch = vi.fn(async () => programDetail)
    const client = { get: vi.fn(async () => programDetail), getWithMeta: vi.fn(), patch, post: vi.fn() }
    const repository = new ApiProgramsRepository(client as never)
    const category = await repository.getCategory(programDetail.id)
    expect(category?.relatedTemplates[0]).toMatchObject({ id: programDetail.relatedTemplates[0]?.id, name: "Семейный день" })
    await repository.saveCategory({ ...category!, name: "Семейный отдых" })
    expect(patch).toHaveBeenCalledWith(`/programs/categories/${programDetail.id}`, expect.objectContaining({ version: 2, name: "Семейный отдых", operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })

  it("loads and version-patches event categories with related events", async () => {
    const patch = vi.fn(async () => eventDetail)
    const client = { get: vi.fn(async () => eventDetail), getWithMeta: vi.fn(), patch, post: vi.fn() }
    const repository = new ApiEventsRepository(client as never)
    const category = await repository.getCategory(eventDetail.id)
    expect(category?.relatedEvents[0]).toMatchObject({ id: eventDetail.relatedEvents[0]?.id, clientName: "Анна" })
    await repository.saveCategory({ ...category!, tone: "violet" })
    expect(patch).toHaveBeenCalledWith(`/events/categories/${eventDetail.id}`, expect.objectContaining({ version: 3, tone: "violet", operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })
})
