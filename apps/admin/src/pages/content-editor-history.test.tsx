import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { editorFixtures } from "@admin/fixtures/cms"
import { EditorTabContent } from "./content-editor-page"

describe("CMS revision history", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows actual revisions and loads older entries without invented compare actions", async () => {
    const draft = editorFixtures["landing-family"]!
    const history = vi.spyOn(cmsRepository, "getRevisionHistory").mockImplementation(async (_id, before) => before === undefined
      ? { items: [{ id: "revision-4", revision: 4, state: "draft", title: "Новая редакция", path: "/family", createdAt: "2026-09-27T10:00:00.000Z", createdBy: null }], nextBefore: 4 }
      : { items: [{ id: "revision-2", revision: 2, state: "published", title: "Старая редакция", path: "/old-family", createdAt: "2026-08-01T10:00:00.000Z", createdBy: null }], nextBefore: null })
    render(<TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="landing" tab="versions" update={vi.fn()} updateSection={vi.fn()} /></TooltipProvider>)

    expect(await screen.findByText("Редакция 4")).toBeInTheDocument()
    expect(screen.getByText("Текущая")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Показать более ранние" }))
    expect(await screen.findByText("Редакция 2")).toBeInTheDocument()
    expect(history).toHaveBeenLastCalledWith(draft.id, 4)
    expect(screen.queryByRole("button", { name: "Сравнить" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Показать более ранние" })).not.toBeInTheDocument()
  })
})
