import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { ContentEditorPage } from "@admin/pages/content-editor-page"

describe("offering content code handoff", () => {
  it("keeps technical files out of the normal editorial dossier", async () => {
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={["/offers/houses/house-lesnoy?tab=code"]}><Routes>
      <Route element={<ContentEditorPage kind="profile" nodeId="house-lesnoy" workspace="offering" />} path="/offers/houses/:offeringId" />
    </Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)

    expect(await screen.findByRole("tab", { name: "Содержимое" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Файлы и код" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Artifact ещё не привязан к странице" })).not.toBeInTheDocument()
  })
})
