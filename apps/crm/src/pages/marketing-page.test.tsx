import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import type { MarketingReport, Promotion } from "@crm/contracts"
import { MarketingPage } from "./marketing-page"

const item: Promotion = { id: "11111111-1111-4111-8111-111111111111", version: 1, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", terms: { code: "SUMMER", name: "Лето", active: true, discountType: "percent", value: 10, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] } }
const report: MarketingReport = { period: { from: "2026-09-01", to: "2026-09-30" }, visitorsStatus: "not_configured", visitors: null, attributionModel: "lead_snapshot", promotions: [{ promotionId: item.id, bookings: 3, confirmedBookings: 2, bookingAmountMinor: 3_000_000, discountAmountMinor: 300_000, paidAmountMinor: 2_000_000 }], campaigns: [{ source: "yandex", medium: "cpc", campaign: "summer", content: "", term: "", leads: 8, qualifiedLeads: 4, bookings: 3, paidAmountMinor: 2_000_000 }] }
function repository(canManage = true) { return { list: vi.fn().mockResolvedValue({ items: [item], canManage }), report: vi.fn().mockResolvedValue(report), get: vi.fn(), create: vi.fn(), update: vi.fn() } }
function Probe() { const location = useLocation(); return <output aria-label="URL">{location.pathname}{location.search}</output> }

describe("MarketingPage", () => {
  it("renders a compact sortable registry and URL tabs", async () => {
    const gateway = repository()
    render(<MemoryRouter initialEntries={["/marketing?from=2026-09-01&to=2026-09-30"]}><MarketingPage repository={gateway} /><Probe /></MemoryRouter>)
    const table = await screen.findByRole("table")
    expect(within(table).getByText("SUMMER")).toBeInTheDocument()
    expect(within(table).getByText(/20\s*000.*₽/)).toBeInTheDocument()
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7)
    expect(within(table).getAllByRole("button")).toHaveLength(7)
    const user = userEvent.setup()
    await user.click(within(table).getByRole("button", { name: "Брони" }))
    expect(screen.getByLabelText("URL")).toHaveTextContent("sort=bookings&order=asc")
    await user.click(within(table).getByRole("button", { name: "Брони" }))
    expect(screen.getByLabelText("URL")).toHaveTextContent("order=desc")
    await user.click(screen.getByRole("tab", { name: "Источники" }))
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")).toHaveLength(6)
    expect(screen.getByLabelText("URL")).toHaveTextContent("tab=attribution")
    expect(gateway.report).toHaveBeenCalledWith({ from: "2026-09-01", to: "2026-09-30" })
  })

  it("keeps the promotion registry available when finance analytics fails", async () => {
    const gateway = repository(false)
    gateway.report.mockRejectedValueOnce(new Error("Отчёт временно недоступен"))
    render(<MemoryRouter><MarketingPage repository={gateway} /></MemoryRouter>)
    expect(await screen.findByText(/Отчёт временно недоступен/)).toBeInTheDocument()
    expect(await screen.findByRole("table")).toBeInTheDocument()
    expect(within(screen.getByRole("table")).getAllByText("—").length).toBeGreaterThan(0)
    expect(screen.queryByText("0 ₽")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Промокод" })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: "Повторить" }))
    await waitFor(() => expect(gateway.report).toHaveBeenCalledTimes(2))
  })

  it("rejects reversed periods and shows an honest empty state", async () => {
    const gateway = repository()
    gateway.list.mockResolvedValue({ items: [], canManage: false })
    render(<MemoryRouter initialEntries={["/marketing?from=2026-09-30&to=2026-09-01"]}><MarketingPage repository={gateway} /></MemoryRouter>)
    expect(await screen.findByRole("alert")).toHaveTextContent("начало не позже окончания")
    expect(gateway.report).not.toHaveBeenCalled()
    expect(await screen.findByText("Промокодов пока нет")).toBeInTheDocument()
    expect(gateway.list).toHaveBeenCalledOnce()
  })

  it("filters attribution rows from URL without hiding the compact controls", async () => {
    const gateway = repository()
    gateway.report.mockResolvedValue({
      ...report,
      campaigns: [
        ...report.campaigns,
        { source: "vk", medium: "social", campaign: "family", content: "video", term: "", leads: 2, qualifiedLeads: 1, bookings: 0, paidAmountMinor: 0 },
      ],
    })
    render(<MemoryRouter initialEntries={["/marketing?tab=attribution&source=vk&from=2026-09-01&to=2026-09-30"]}><MarketingPage repository={gateway} /></MemoryRouter>)

    const table = await screen.findByRole("table")
    expect(within(table).getByText("vk")).toBeInTheDocument()
    expect(within(table).queryByText("yandex")).not.toBeInTheDocument()
    expect(screen.getAllByLabelText("Источник").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Канал")).toBeInTheDocument()
  })

  it("opens a promotion from the whole desktop row or mobile card while attribution stays inert", async () => {
    const gateway = repository()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={["/marketing?from=2026-09-01&to=2026-09-30"]}><MarketingPage repository={gateway} /><Probe /></MemoryRouter>)

    const desktopRow = await screen.findByRole("row", { name: "Открыть промокод SUMMER" })
    desktopRow.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByLabelText("URL")).toHaveTextContent(`/marketing/promotions/${item.id}`)

    cleanup()
    render(<MemoryRouter initialEntries={["/marketing?from=2026-09-01&to=2026-09-30"]}><MarketingPage repository={gateway} /><Probe /></MemoryRouter>)
    const mobileCardLink = await screen.findByRole("link", { name: "Открыть промокод SUMMER" })
    await user.click(mobileCardLink)
    expect(screen.getByLabelText("URL")).toHaveTextContent(`/marketing/promotions/${item.id}`)

    cleanup()
    render(<MemoryRouter initialEntries={["/marketing?tab=attribution&from=2026-09-01&to=2026-09-30"]}><MarketingPage repository={gateway} /></MemoryRouter>)
    const attributionTable = await screen.findByRole("table")
    expect(within(attributionTable).getByText("yandex").closest("tr")).not.toHaveAttribute("tabindex")
    expect(screen.queryByLabelText(/Открыть промокод/)).not.toBeInTheDocument()
  })
})
