import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import type { ContentNode } from "@admin/entities/cms"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { seoIssues } from "@admin/pages/seo-issues"
import { SeoPage } from "@admin/pages/seo-page"

function renderSeo(entry: string) {
  return render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={[entry]}><Routes>
    <Route element={<SeoPage />} path="/seo" />
    <Route element={<SeoPage />} path="/seo/pages/:nodeId" />
  </Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
}

afterEach(() => vi.restoreAllMocks())

it("shows real fixture pages and opens a concrete SEO report", async () => {
  renderSeo("/seo")
  expect(await screen.findByRole("heading", { name: "SEO" })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole("link", { name: /Отдых с детьми/ }))
  expect(await screen.findByRole("heading", { name: "SEO: Отдых с детьми" })).toBeInTheDocument()
  expect(screen.getByText("Семейный отдых на природе")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Открыть SEO в редакторе/ })).toHaveAttribute("href", "/content/pages/landing-family?tab=seo")
})

it("separates the active publication from the working SEO revision", async () => {
  vi.spyOn(cmsRepository, "getPublicationStatus").mockResolvedValue({
    active: true, path: "/family", revisionId: "00000000-0000-4000-8000-000000000010",
    activeReleaseId: "00000000-0000-4000-8000-000000000020", activeReleaseVersion: 1,
    publishedSeo: { title: "Старый заголовок", description: "Старое описание", indexPolicy: "noindex_follow", canonical: { mode: "custom", url: "https://example.org/family" } },
  })
  renderSeo("/seo/pages/landing-family")
  expect(await screen.findByText("В активной публикации: /family")).toBeInTheDocument()
  expect(screen.getByText("От рабочей редакции отличаются: заголовок, описание, индексация, canonical.")).toBeInTheDocument()
  expect(screen.getByText("Старый заголовок")).toBeInTheDocument()
  expect(screen.getByText(/SEO-поля ниже относятся к рабочей редакции CMS/)).toBeInTheDocument()
})

it("does not claim an active publication when its status cannot be checked", async () => {
  const status = vi.spyOn(cmsRepository, "getPublicationStatus")
    .mockRejectedValueOnce(new Error("Сеть недоступна"))
    .mockResolvedValue({ active: false, path: null, revisionId: null, activeReleaseId: null, activeReleaseVersion: 1 })
  renderSeo("/seo/pages/landing-family")
  expect(await screen.findByText("Не удалось проверить активную публикацию")).toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent("Сеть недоступна")
  fireEvent.click(screen.getByRole("button", { name: "Повторить проверку" }))
  expect(await screen.findByText("Не входит в активную публикацию")).toBeInTheDocument()
  expect(status).toHaveBeenCalledTimes(2)
})

it("reports only checks supported by current SEO fields", () => {
  const node: ContentNode = {
    id: "page", title: "Страница", path: "/page", pageKind: "landing", sortOrder: 10, type: "landing", status: "draft", quality: "ok", parentId: null, children: [], owner: "CMS", updatedLabel: "сейчас", inboundLinks: null, mediaCount: null,
    seo: { title: "Д".repeat(61), description: "О".repeat(161), indexPolicy: "noindex_follow", canonical: { mode: "self" } },
  }
  expect(seoIssues(node)).toEqual([
    { field: "SEO title", message: "Заголовок длиннее 60 символов (61)" },
    { field: "SEO description", message: "Описание длиннее 160 символов (161)" },
  ])
})
