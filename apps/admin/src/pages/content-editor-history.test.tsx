import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TooltipProvider } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { editorFixtures } from "@admin/fixtures/cms"
import { EditorTabContent } from "./content-editor-page"

describe("CMS revision history", () => {
  afterEach(() => vi.restoreAllMocks())

  it("loads older revisions and compares saved editorial changes", async () => {
    const draft = editorFixtures["landing-family"]!
    const previous = { ...draft, publicTitle: "Старый заголовок", description: "Старое описание", url: "/old-family" }
    const history = vi.spyOn(cmsRepository, "getRevisionHistory").mockImplementation(async (_id, before) => before === undefined
      ? { items: [{ id: "revision-4", revision: draft.revision ?? draft.version, state: "draft", title: "Новая редакция", path: "/family", createdAt: "2026-09-27T10:00:00.000Z", createdBy: null }], nextBefore: 4 }
      : { items: [{ id: "revision-2", revision: 2, state: "published", title: "Старая редакция", path: "/old-family", createdAt: "2026-08-01T10:00:00.000Z", createdBy: null }], nextBefore: null })
    const getRevision = vi.spyOn(cmsRepository, "getRevisionEditor").mockResolvedValue(previous)
    const restore = vi.fn().mockResolvedValue(undefined)
    render(<TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="landing" onRestoreRevision={restore} tab="versions" update={vi.fn()} updateSection={vi.fn()} /></TooltipProvider>)

    expect(await screen.findByText(`Редакция ${draft.revision ?? draft.version}`)).toBeInTheDocument()
    expect(screen.getByText("Текущая")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Показать более ранние" }))
    expect(await screen.findByText("Редакция 2")).toBeInTheDocument()
    expect(history).toHaveBeenLastCalledWith(draft.id, 4)
    await userEvent.click(screen.getByRole("button", { name: "Сравнить редакцию 2" }))
    expect(getRevision).toHaveBeenCalledWith(draft.id, "revision-2")
    expect(await screen.findByText("Старый заголовок")).toBeInTheDocument()
    expect(screen.getByText("Старое описание")).toBeInTheDocument()
    expect(screen.getByText(/При восстановлении останется нынешний адрес/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Вернуть в новый черновик" }))
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: "revision-2" }))
    expect(screen.queryByRole("button", { name: "Показать более ранние" })).not.toBeInTheDocument()
  })

  it("does not restore while the current page has unsaved work", async () => {
    const draft = editorFixtures["landing-family"]!
    vi.spyOn(cmsRepository, "getRevisionHistory").mockResolvedValue({ items: [{ id: "old", revision: 1, state: "published", title: "Старый заголовок", path: "/old", createdAt: null, createdBy: null }], nextBefore: null })
    vi.spyOn(cmsRepository, "getRevisionEditor").mockResolvedValue({ ...draft, publicTitle: "Старый заголовок" })
    render(<TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="landing" onRestoreRevision={vi.fn()} restoreDisabled tab="versions" update={vi.fn()} updateSection={vi.fn()} /></TooltipProvider>)
    await userEvent.click(await screen.findByRole("button", { name: "Сравнить редакцию 1" }))
    expect(await screen.findByRole("button", { name: "Вернуть в новый черновик" })).toBeDisabled()
    expect(screen.getByText("Сохраните текущие правки перед восстановлением.")).toBeInTheDocument()
  })
})
