import { describe, expect, it, vi } from "vitest"
import type { DataSource } from "typeorm"

import type { SessionUser } from "@crm/contracts"
import type { ProgramTemplateEntity } from "@crm/db"

import { listProgramTemplates } from "./programs-read-projection.js"

const templateId = "11111111-1111-4111-8111-111111111111"
const actor = { capabilities: {} } as SessionUser
const template = {
  id: templateId, version: 2, code: "DEMO-PROGRAM", name: "Чайный мастер-класс", categoryId: null,
  durationMinutes: 120, minimumParticipants: 2, participantLimit: 16, registrationCloseHours: null,
  basePriceAmount: 150000, currency: "RUB", description: "", publication: "published", assigneeIds: [], stages: [],
  archivedAt: null, createdBy: null, updatedBy: null, createdAt: new Date("2026-09-01T10:00:00.000Z"), updatedAt: new Date("2026-09-28T10:00:00.000Z"),
} as ProgramTemplateEntity

type PriceRow = { templateId: string; offeringId: string; currency: string; priceMode: "from" | "exact"; amountMinor: number; amountCount: string }

function source(priceRows: PriceRow[]) {
  const builder = { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([template]) }
  const query = vi.fn().mockResolvedValue(priceRows)
  return { dataSource: { getRepository: vi.fn().mockReturnValue({ createQueryBuilder: () => builder }), query } as unknown as DataSource, query }
}

describe("program template list prices", () => {
  it("shows the active offering price without changing the legacy template price", async () => {
    const { dataSource, query } = source([{ templateId, offeringId: "22222222-2222-4222-8222-222222222222", currency: "RUB", priceMode: "from", amountMinor: 160000, amountCount: "1" }])
    const result = await listProgramTemplates(dataSource, { limit: 50 }, actor)

    expect(result.items[0]).toMatchObject({ basePrice: { amountMinor: 150000 }, activePrice: { amountMinor: 160000, currency: "RUB" } })
    expect(query).toHaveBeenCalledWith(expect.any(String), [[templateId]])
  })

  it("does not choose an arbitrary price when multiple offerings match one program", async () => {
    const { dataSource } = source([
      { templateId, offeringId: "22222222-2222-4222-8222-222222222222", currency: "RUB", priceMode: "from", amountMinor: 160000, amountCount: "1" },
      { templateId, offeringId: "33333333-3333-4333-8333-333333333333", currency: "RUB", priceMode: "from", amountMinor: 180000, amountCount: "1" },
    ])
    const result = await listProgramTemplates(dataSource, { limit: 50 }, actor)
    expect(result.items[0]?.activePrice).toBeNull()
  })

  it("does not show a single exact price when the active book has several amounts", async () => {
    const { dataSource } = source([{ templateId, offeringId: "22222222-2222-4222-8222-222222222222", currency: "RUB", priceMode: "exact", amountMinor: 160000, amountCount: "2" }])
    const result = await listProgramTemplates(dataSource, { limit: 50 }, actor)
    expect(result.items[0]?.activePrice).toBeNull()
  })
})
