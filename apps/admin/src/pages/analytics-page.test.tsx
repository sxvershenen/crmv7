import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { AnalyticsPage } from "./analytics-page"

const { getAnalytics } = vi.hoisted(() => ({ getAnalytics: vi.fn() }))

vi.mock("@admin/data/cms-repository", () => ({
  cmsRepository: { getAnalytics },
}))

const summary = {
  period: "2026-08-14 — 2026-09-12 · Europe/Moscow",
  visitors: 5,
  views: 7,
  leads: 2,
  bookings: 1,
  paid: 1,
  channels: [{ name: "Все источники", value: 5, percent: 100 }],
  pages: [{ path: "Все страницы", views: 7, cta: 3, leads: 2 }],
}

describe("AnalyticsPage", () => {
  beforeEach(() => getAnalytics.mockReset())

  it("renders loading and then the explicit site-wide aggregate", async () => {
    let resolve!: (value: typeof summary) => void
    getAnalytics.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    renderPage()

    expect(screen.queryByRole("heading", { name: "Аналитика" })).not.toBeInTheDocument()
    resolve(summary)

    expect(await screen.findByRole("heading", { name: "Аналитика" })).toBeInTheDocument()
    expect(screen.getAllByText("Все страницы").length).toBeGreaterThan(0)
    expect(screen.getByText(/site-wide first-party aggregate/)).toBeInTheDocument()
  })

  it("shows an error and retries the authoritative repository", async () => {
    getAnalytics.mockRejectedValueOnce(new Error("Аналитика API недоступна")).mockResolvedValueOnce(summary)
    renderPage()

    expect(await screen.findByText("Аналитика API недоступна")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }))

    expect(await screen.findByRole("heading", { name: "Аналитика" })).toBeInTheDocument()
    expect(getAnalytics).toHaveBeenCalledTimes(2)
  })
})

function renderPage() {
  return render(<TooltipProvider><MemoryRouter initialEntries={["/analytics"]}><Routes><Route element={<AnalyticsPage />} path="/analytics/*" /></Routes></MemoryRouter></TooltipProvider>)
}
