import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { InternalOfferingEditor } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"

import { ScheduledResourcePricing } from "./scheduled-resource-pricing"

const editor = {
  offering: { timezone: "Europe/Moscow" },
  addOnTerms: { serviceType: "scheduled_resource" },
  priceBooks: [],
  ownerVersions: { pricing: 1 },
  capabilities: { pricing: { canEditDraft: true, canActivate: true } },
  editorial: { node: { id: "11111111-1111-4111-8111-111111111111" } },
} as unknown as InternalOfferingEditor

describe("ScheduledResourcePricing", () => {
  it("saves the six actual sauna guest-tier tariffs as one CRM price book", async () => {
    const user = userEvent.setup()
    const createDraftPriceBook = vi.fn().mockResolvedValue({})
    render(<ScheduledResourcePricing gateway={{ getAddOnEditor: vi.fn().mockResolvedValue(editor), createDraftPriceBook } as unknown as OfferingEditorGateway} offeringId="22222222-2222-4222-8222-222222222222" resourceName="Баня Кедр" onNavigationGuardChange={vi.fn()} />)
    await user.click(await screen.findByRole("button", { name: "Заполнить тарифы бани" }))
    expect(screen.getAllByLabelText("Цена, ₽")).toHaveLength(6)
    await user.type(screen.getByLabelText("Причина изменения"), "Новый сезон")
    await user.click(screen.getByRole("button", { name: "Сохранить черновик цены" }))
    await waitFor(() => expect(createDraftPriceBook).toHaveBeenCalledTimes(1))
    expect(createDraftPriceBook.mock.calls[0]?.[1]).toMatchObject({ ratePlans: [
      { key: "standard_6", baseAmount: 300_000, minQuantity: 1, maxQuantity: 6, pricingBasis: "per_hour" },
      { key: "standard_10", baseAmount: 350_000, minQuantity: 7, maxQuantity: 10 },
      { key: "standard_15", baseAmount: 400_000, minQuantity: 11, maxQuantity: 15 },
      { key: "all_inclusive_6", baseAmount: 600_000 },
      { key: "all_inclusive_10", baseAmount: 700_000 },
      { key: "all_inclusive_15", baseAmount: 800_000 },
    ] })
  })

  it("saves chan as a session price without inventing a fixed duration", async () => {
    const user = userEvent.setup()
    const createDraftPriceBook = vi.fn().mockResolvedValue({})
    render(<ScheduledResourcePricing gateway={{ getAddOnEditor: vi.fn().mockResolvedValue(editor), createDraftPriceBook } as unknown as OfferingEditorGateway} offeringId="33333333-3333-4333-8333-333333333333" resourceName="Банный чан" onNavigationGuardChange={vi.fn()} />)
    await user.click(await screen.findByRole("button", { name: "Заполнить чан" }))
    await user.type(screen.getByLabelText("Причина изменения"), "Первый тариф")
    await user.click(screen.getByRole("button", { name: "Сохранить черновик цены" }))
    await waitFor(() => expect(createDraftPriceBook).toHaveBeenCalledTimes(1))
    expect(createDraftPriceBook.mock.calls[0]?.[1]).toMatchObject({ ratePlans: [{ pricingBasis: "per_slot", baseAmount: 560_000, minDurationMinutes: null, maxDurationMinutes: null }] })
  })
})
