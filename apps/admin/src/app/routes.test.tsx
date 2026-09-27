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
    expect(labels).toContain("История публикаций")
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

  it("distinguishes a current draft from its earlier publication in the tree", async () => {
    renderWithRouter(<ContentTreePage />, "/content/tree?selected=house-lesnoy")
    expect(await screen.findByRole("heading", { name: "Домик «Лесной»" })).toBeInTheDocument()
    expect(screen.getByText("Статус относится к редакции. Страницы на сайте определяются активной публикацией.")).toBeInTheDocument()
    expect(screen.getByText("Ранее публиковалась")).toBeInTheDocument()
  })

  it("labels the editor workflow and previous publication separately", async () => {
    renderWithRouter(<ContentEditorPage kind="profile" />, "/content/public-profiles/resource/house-lesnoy", "/content/public-profiles/resource/:nodeId")
    expect(await screen.findByText("Редакция 11 публиковалась")).toBeInTheDocument()
    expect(await screen.findByText("Не в активной публикации")).toBeInTheDocument()
    expect(screen.getByText("Статус показывает состав активной публикации; доставка до сайта проверяется отдельно.")).toBeInTheDocument()
    expect(screen.getByText("/domiki/lesnoy · Редакция 12")).toBeInTheDocument()
  })

  it("redirects an existing profile opened through the landing URL to its canonical editor", async () => {
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={["/content/pages/house-lesnoy?tab=seo"]}><Routes>
      <Route element={<ContentEditorPage kind="landing" />} path="/content/pages/:nodeId" />
      <Route element={<><p>Канонический профиль</p><ContentEditorPage kind="profile" /></>} path="/content/public-profiles/resource/:entityId" />
    </Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)

    expect(await screen.findByText("Канонический профиль")).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Metadata" })).toBeInTheDocument()
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
    expect(screen.getByRole("button", { name: "Выбрать: фоновое изображение" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Выбрать: фон для телефона" })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Показывать основную кнопку" })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: "Показывать вторую кнопку" })).not.toBeChecked()
  })

  it("chooses a ready hero image without losing unsaved page text", async () => {
    renderWithRouter(<ContentEditorPage kind="landing" />, "/content/pages/landing-family", "/content/pages/:nodeId")
    const title = await screen.findByLabelText("Заголовок hero")
    fireEvent.change(title, { target: { value: "Несохранённый заголовок" } })
    fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
    fireEvent.click(await screen.findByRole("button", { name: /Hero · зимний лес/ }))
    expect(title).toHaveValue("Несохранённый заголовок")
    expect(await screen.findByText("Hero · зимний лес")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
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
