import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { navGroups, quickCreateItems } from "@admin/app/navigation"
import { ContentEditorPage } from "@admin/pages/content-editor-page"
import { buildContentTree, ContentTreePage } from "@admin/pages/content-tree-page"
import type { ContentNode } from "@admin/entities/cms"
import { AnalyticsPage } from "@admin/pages/analytics-page"
import { NavigationPage } from "@admin/pages/navigation-page"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"

describe("CMS route screens", () => {
  it("exposes the publication journal without a technical release quick-create action", () => {
    const labels = [...navGroups.flatMap((group) => group.items), ...quickCreateItems].map((item) => item.label)
    expect(labels).toContain("Публикации")
    expect(labels).not.toContain("Релиз")
  })

  it("uses the site tree as the only page registry", () => {
    const labels = navGroups.flatMap((group) => group.items).map((item) => item.label)
    const hrefs = navGroups.flatMap((group) => group.items).map((item) => item.href)
    expect(labels).toContain("Страницы сайта")
    expect(labels).not.toContain("Домики")
    expect(labels).not.toContain("Каталоги и категории")
    expect(labels).not.toContain("Посадочные")
    expect(hrefs).not.toContain("/content/public-profiles")
    expect(hrefs).not.toContain("/offers/domiki")
  })

  it("restores the selected content node from the URL", async () => {
    renderWithRouter(<ContentTreePage />, "/content/tree?selected=houses")
    expect(await screen.findByRole("heading", { name: "Домики" })).toBeInTheDocument()
    expect(screen.getAllByText("/domiki")).toHaveLength(2)
  })

  it("collapses and restores profiles beneath the houses group", async () => {
    renderWithRouter(<ContentTreePage />, "/content/tree")
    const collapse = await screen.findByRole("button", { name: "Свернуть Домики" })
    expect(screen.getByRole("button", { name: /Домик «Лесной»/ })).toBeInTheDocument()

    fireEvent.click(collapse)
    expect(screen.queryByRole("button", { name: /Домик «Лесной»/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Развернуть Домики" })).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(screen.getByRole("button", { name: "Развернуть Домики" }))
    expect(screen.getByRole("button", { name: /Домик «Лесной»/ })).toBeInTheDocument()
  })

  it("keeps matching house profiles under their parent while searching", async () => {
    renderWithRouter(<ContentTreePage />, "/content/tree?collapsed=houses")
    await screen.findByRole("button", { name: "Развернуть Домики" })

    fireEvent.change(screen.getByLabelText("Поиск по структуре"), { target: { value: "Лесной" } })

    expect(await screen.findByRole("button", { name: "Домики /domiki" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Домик «Лесной»/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Свернуть Домики" })).toHaveAttribute("aria-expanded", "true")
  })

  it("uses authoritative route sortOrder before the API item order in the tree", () => {
    const nodes = [treeNode("later", "Яблоня", 20), treeNode("first", "Арена", 10), treeNode("same-order", "Бор", 10)]

    expect(buildContentTree(nodes, "").visibleNodes.map((node) => node.id)).toEqual(["first", "same-order", "later"])
  })

  it("opens route-driven editor tab from query params", async () => {
    renderWithRouter(<ContentEditorPage kind="landing" />, "/content/pages/landing-family?tab=seo", "/content/pages/:nodeId")
    expect(await screen.findByRole("heading", { name: "Metadata" })).toBeInTheDocument()
    expect(screen.getByText(/checks passed/)).toBeInTheDocument()
  })

  it("initializes a saveable child draft from the tree parent query", async () => {
    renderWithRouter(<ContentEditorPage kind="landing" />, "/content/pages/new?parentNodeId=houses", "/content/pages/new")

    expect(await screen.findByLabelText("Родительский раздел")).toHaveValue("houses")
    expect(screen.getAllByText("/domiki/new-page").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
  })

  it("edits the page hero directly inside the content tab", async () => {
    renderWithRouter(<ContentEditorPage kind="landing" />, "/content/pages/landing-family", "/content/pages/:nodeId")
    expect(await screen.findByRole("heading", { name: "Hero этой страницы" })).toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок hero")).toHaveValue("Семейный отдых на природе")
    expect(screen.getByLabelText("Фоновое изображение")).toBeInTheDocument()
  })

  it("renders the full public navigation editor", async () => {
    renderWithRouter(<NavigationPage />, "/globals/navigation")
    expect(await screen.findByRole("heading", { name: "Навигация сайта" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Проживание")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Добавить подпункт" }).length).toBeGreaterThan(0)
  })

  it("renders funnel analytics on its canonical route", async () => {
    renderWithRouter(<AnalyticsPage />, "/analytics/funnels", "/analytics/*")
    expect(await screen.findByRole("heading", { name: "Воронка" })).toBeInTheDocument()
    expect(screen.getByText("Confirmed bookings")).toBeInTheDocument()
  })
})

function renderWithRouter(element: React.ReactNode, entry: string, path = "*") {
  return render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={[entry]}><Routes><Route element={element} path={path} /></Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
}

function treeNode(id: string, title: string, sortOrder: number): ContentNode {
  return { id, title, path: `/${id}`, pageKind: "landing", sortOrder, type: "landing", status: "draft", quality: "ok", parentId: null, children: [], owner: "CMS", updatedLabel: "сейчас", inboundLinks: null, mediaCount: null, source: "CMS" }
}
