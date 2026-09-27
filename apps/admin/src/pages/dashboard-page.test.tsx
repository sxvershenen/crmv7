import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { DashboardPage } from "./dashboard-page"

const { getDashboard } = vi.hoisted(() => ({ getDashboard: vi.fn() }))
vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getDashboard } }))
vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: { canEditContent: true, canManageMedia: true, canViewAnalytics: true } } }) }))
const summary = { hasPublication: false, publishedAt: "Пока не публиковали", metrics: [], attention: [{ id: "production-release", title: "Сайт ещё не опубликован", detail: "Опубликуйте первую страницу", href: "/content/tree" }] }

beforeEach(() => getDashboard.mockReset())

it("guides the first publication through pages without inventing site health or analytics", async () => {
  getDashboard.mockResolvedValue(summary)
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Пока не опубликован")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Открыть страницы" })).toBeInTheDocument()
  expect(screen.queryByText("Сайт работает")).not.toBeInTheDocument()
  expect(screen.queryByText(/Опубликуйте первую страницу/)).not.toBeInTheDocument()
  expect(screen.getByText("Дополнительных уведомлений пока нет.")).toBeInTheDocument()
  expect(screen.queryByText("Prototype state")).not.toBeInTheDocument()
})

it("shows delivery trouble independently from an existing publication", async () => {
  getDashboard.mockResolvedValue({ ...summary, hasPublication: true, publishedAt: "12 сент., 20:00", attention: [{ id: "delivery-failures", title: "Есть ошибки доставки публикации", href: "/releases" }] })
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Проверить доставку")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Есть ошибки доставки публикации" })).toHaveAttribute("href", "/releases")
  expect(screen.queryByText("Изменения опубликованы")).not.toBeInTheDocument()
})

it("distinguishes pending delivery from an active version with no delivery alert", async () => {
  getDashboard.mockResolvedValue({ ...summary, hasPublication: true, attention: [{ id: "delivery-pending", title: "Доставка публикации выполняется", href: "/releases" }] })
  const { unmount } = render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Доставка выполняется")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Доставка публикации выполняется" })).toHaveAttribute("href", "/releases")

  unmount()
  getDashboard.mockResolvedValue({ ...summary, hasPublication: true, attention: [] })
  render(<MemoryRouter><DashboardPage /></MemoryRouter>)
  expect(await screen.findByText("Активная версия сайта")).toBeInTheDocument()
})
