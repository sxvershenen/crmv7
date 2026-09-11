import { randomUUID } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import type { PublicLeadIntake } from "@crm/contracts"

import { PublicIntakeService } from "./public-intake.service.js"

function validInput(): PublicLeadIntake {
  return {
    operationId: randomUUID(), idempotencyKey: "public-intake-unit-key-0001", name: "Иван", phone: "+7 921 450-12-40",
    intent: { kind: "general" }, attribution: { source: null, medium: null, campaign: null, content: null, term: null, referrer: null, landingPath: "/" },
    consent: { privacyAccepted: true, marketingAccepted: false, analyticsAccepted: false, policyVersion: "2026-09" },
  }
}

describe("PublicIntakeService input normalization", () => {
  it("rejects values that become empty or invalid after sanitization before opening a transaction", async () => {
    const transaction = vi.fn()
    const service = new PublicIntakeService({ transaction } as never)
    await expect(service.submit({ ...validInput(), name: "\u0000" }, randomUUID())).rejects.toMatchObject({ status: 400 })
    await expect(service.submit({ ...validInput(), email: "not-an-email" } as PublicLeadIntake, randomUUID())).rejects.toMatchObject({ status: 400 })
    await expect(service.submit({ ...validInput(), intent: { kind: "general", startDate: "2026-99-99" } } as PublicLeadIntake, randomUUID())).rejects.toMatchObject({ status: 400 })
    await expect(service.submit({ ...validInput(), intent: { kind: "general", startDate: "2026-10-12", endDate: "2026-10-10" } }, randomUUID())).rejects.toMatchObject({ status: 400 })
    expect(transaction).not.toHaveBeenCalled()
  })
})
