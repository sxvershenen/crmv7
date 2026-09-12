import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { DashboardPage } from "./dashboard-page"

const { getDashboard } = vi.hoisted(() => ({ getDashboard: vi.fn() }))
vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getDashboard } }))
vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: { canEditContent: true, canManageMedia: true, canViewAnalytics: true } } }) }))
const summary = { hasPublication: false, queueHealthy: true, publishedAt: "Пока не публиковали", metrics: [], attention: [{ id: "production-release", title: "Сайт ещё не опубликован", detail: "Создайте release", href: "/releases" }, { id: "analytics-not-configured", title: "Сбор веб-аналитики не настроен", href: "/analytics" }] }

beforeEach(() => getDashboard.mockReset())

it("guides the first publication through pages without inventing site health or analytics", async () => {
  getDashboard.mockResolvedValue(summary)
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Пока не опубликован")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Открыть страницы" })).toBeInTheDocument()
  expect(screen.queryByText("Сайт работает")).not.toBeInTheDocument()
  expect(screen.queryByText("Сбор веб-аналитики не настроен")).not.toBeInTheDocument()
  expect(screen.queryByText(/Создайте release/)).not.toBeInTheDocument()
  expect(screen.queryByText("Prototype state")).not.toBeInTheDocument()
})

it("shows delivery trouble independently from an existing publication", async () => {
  getDashboard.mockResolvedValue({ ...summary, hasPublication: true, queueHealthy: false, publishedAt: "12 сент., 20:00", attention: [{ id: "delivery-failures", title: "Есть ошибки доставки", href: "/settings/integrations" }] })
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Проверить доставку")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Есть ошибки доставки" })).toHaveAttribute("href", "/releases")
  expect(screen.queryByText("Изменения опубликованы")).not.toBeInTheDocument()
})
