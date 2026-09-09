import { expect, test, type Page } from "@playwright/test"

async function login(page: Page) {
  await page.goto("/programs")
  await expect(page.getByRole("heading", { name: "Вход в CRM" })).toBeVisible()
  await page.getByLabel("Пароль").fill("change-me-in-local-env")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page.getByRole("tab", { name: "Шаблоны" })).toBeVisible()
}

test("priced registration accepts the exact quote and reloads the immutable add-on snapshot", async ({ page }) => {
  await login(page)
  const occurrenceId = await page.evaluate(async () => {
    const serviceDate = "2026-09-20"
    const serviceDateExclusive = "2026-09-21"
    const command = () => ({ operationId: crypto.randomUUID(), idempotencyKey: `e2e-${crypto.randomUUID()}` })
    const json = async (path: string, init?: RequestInit) => {
      const response = await fetch(`/api/internal/v1${path}`, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } })
      if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`)
      return response.json() as Promise<Record<string, unknown>>
    }
    const calendars = await json("/business-calendars?state=active&limit=10")
    const activeCalendars = calendars.items as Array<{ id: string; coverage: { from: string; toExclusive: string } | null }>
    if (activeCalendars.length !== 1) throw new Error(`Expected one active business calendar, got ${activeCalendars.length}`)
    const coverage = activeCalendars[0]?.coverage
    if (!coverage || coverage.from > serviceDate || coverage.toExclusive < serviceDateExclusive) {
      throw new Error(`Active business calendar does not cover ${serviceDate}`)
    }
    const template = await json("/programs/templates", { method: "POST", body: JSON.stringify({
      code: `E2E-REG-${Date.now()}`, name: "E2E priced registration", categoryId: null, durationMinutes: 120, minimumParticipants: 1,
      participantLimit: 12, registrationCloseHours: null, basePrice: { amountMinor: 0, currency: "RUB" }, description: "", publication: "draft", assigneeIds: [], stages: [], ...command(),
    }) })
    const templateId = String(template.id)
    const prepared = await json(`/programs/${templateId}/offering`, { method: "POST", body: JSON.stringify({ expectedProgramTemplateVersion: Number(template.version), ...command() }) })
    const offeringId = String(prepared.offeringId)
    const editor = await json(`/offerings/${offeringId}/editor`)
    const ownerVersions = editor.ownerVersions as { pricing: number; addOnAssignments: number }
    const createdBook = await json(`/offerings/${offeringId}/price-books/drafts`, { method: "POST", body: JSON.stringify({
      expectedPricingVersion: ownerVersions.pricing, supersedesPriceBookId: null, name: "E2E registration tariff", validFrom: coverage.from, validToExclusive: serviceDateExclusive, changeReason: "E2E",
      ratePlans: [{ key: "standard", label: "Участник", pricingBasis: "per_person", quantityMetric: "participants", baseAmount: 250000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: 1, maxQuantity: 12, minDurationMinutes: 120, maxDurationMinutes: 120, isDefault: true, displayOrder: 0, rules: [] }],
      ...command(),
    }) })
    const priceBook = createdBook.priceBook as { id: string }
    await json(`/offerings/${offeringId}/price-books/${priceBook.id}/activate`, { method: "POST", body: JSON.stringify({ expectedPricingVersion: Number(createdBook.pricingVersion), reason: "E2E checked", ...command() }) })
    const library = await json("/addons?state=active&serviceType=person_service&limit=100")
    const addOn = (library.items as Array<{ offering: { id: string; code: string } }>).find((item) => item.offering.code === "ADDON-BREAKFAST")
    if (!addOn) throw new Error("Seeded breakfast add-on is missing")
    await json(`/offerings/${offeringId}/add-ons`, { method: "PUT", body: JSON.stringify({
      expectedAddOnsVersion: ownerVersions.addOnAssignments,
      assignments: [{ addOnOfferingId: addOn.offering.id, enabled: true, required: false, recommended: true, groupKey: "food", ratePlanKeyOverride: "standard", labelOverride: null, descriptionOverride: null, minQuantityOverride: 1, maxQuantityOverride: 6, defaultQuantityOverride: 2, displayOrder: 1 }],
      ...command(),
    }) })
    const occurrence = await json("/programs/occurrences", { method: "POST", body: JSON.stringify({
      templateId, name: "E2E priced run", startsAt: `${serviceDate}T09:00:00.000Z`, endsAt: `${serviceDate}T11:00:00.000Z`, participantLimit: 12, registrationLimit: 12, comment: "", assigneeIds: [], currency: "RUB", ...command(),
    }) })
    const opened = await json(`/programs/occurrences/${String(occurrence.id)}/transition`, { method: "POST", body: JSON.stringify({ version: Number(occurrence.version), status: "open", ...command() }) })
    return String(opened.id)
  })

  await page.goto(`/programs/registrations/new?run=${occurrenceId}`)
  await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeVisible()
  await page.getByRole("tab", { name: "Участники" }).click()
  await page.getByLabel("Количество участников").fill("2")
  const createResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/programs/registrations"))
  await page.getByRole("button", { name: "Сохранить черновик" }).click()
  const created = await createResponse
  expect(created.status()).toBe(201)
  expect(created.request().postDataJSON()).not.toHaveProperty("total")
  expect(created.request().postDataJSON()).not.toHaveProperty("discount")
  await expect(page).toHaveURL(/\/programs\/registrations\/[0-9a-f-]+$/i)
  await page.reload()

  await page.getByRole("tab", { name: "Оплата" }).click()
  await expect(page.getByText("Цену фиксирует серверный расчёт")).toBeVisible()
  await page.getByLabel("Завтрак в корзине").fill("2")
  const quoteResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/offering/quotes/registration"))
  await page.getByRole("button", { name: "Рассчитать" }).click()
  const quote = await quoteResponse
  const quoteBody = await quote.json() as { quoteId: string; total: { amountMinor: number }; inputs: { addOns: Array<{ assignmentId: string; quantity: number }> } }
  expect(quote.status(), JSON.stringify(quoteBody)).toBe(200)
  expect(quoteBody.inputs.addOns).toHaveLength(1)
  expect(quoteBody.inputs.addOns[0]?.quantity).toBe(2)

  const confirmResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/transition"))
  await page.getByRole("button", { name: "Подтвердить по расчёту" }).click()
  const confirmed = await confirmResponse
  expect(confirmed.status()).toBe(201)
  const confirmedBody = await confirmed.json() as { acceptedQuote: { quoteId: string; total: { amountMinor: number }; addOns: Array<{ quantity: number }> } }
  expect(confirmedBody.acceptedQuote).toMatchObject({ quoteId: quoteBody.quoteId, total: { amountMinor: quoteBody.total.amountMinor }, addOns: [{ quantity: 2 }] })
  await expect(page.getByText("Принятая стоимость")).toBeVisible()

  await page.reload()
  await page.getByRole("tab", { name: "Оплата" }).click()
  await expect(page.getByText("Принятая стоимость")).toBeVisible()
  await expect(page.getByText("Завтрак в корзине × 2")).toBeVisible()
  await expect(page.getByLabel("Принятый расчёт").getByText(new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(quoteBody.total.amountMinor / 100), { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Подтвердить по расчёту" })).toHaveCount(0)
})
