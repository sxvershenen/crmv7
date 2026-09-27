import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

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

it("shows real fixture pages and opens a concrete SEO report", async () => {
  renderSeo("/seo")
  expect(await screen.findByRole("heading", { name: "SEO" })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole("link", { name: /Отдых с детьми/ }))
  expect(await screen.findByRole("heading", { name: "SEO: Отдых с детьми" })).toBeInTheDocument()
  expect(screen.getByText("Семейный отдых на природе")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Открыть SEO в редакторе/ })).toHaveAttribute("href", "/content/pages/landing-family?tab=seo")
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
