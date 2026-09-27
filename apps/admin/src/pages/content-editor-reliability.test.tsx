import { transferableAbortController } from "node:util"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider, MemoryRouter, useNavigate } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { CmsConflictError } from "@admin/entities/cms"
import { editorFixtures, nodeFixtures } from "@admin/fixtures/cms"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { ContentEditorPage } from "./content-editor-page"

describe("ContentEditorPage mutation recovery", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("saves local changes before opening the signed public preview", async () => {
    const originalMode = cmsRepository.mode
    Object.assign(cmsRepository, { mode: "api" })
    try {
      const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111" }
      const saved = { ...initial, version: initial.version + 1, revision: (initial.revision ?? initial.version) + 1, publicTitle: "Новый H1" }
      vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
      vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
      vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
      const save = vi.spyOn(cmsRepository, "saveEditor").mockResolvedValue(saved)
      const token = vi.spyOn(cmsRepository, "getPreviewToken").mockResolvedValue({ token: "p".repeat(40), expiresAt: "2026-09-27T18:00:00.000Z", previewPath: "/family" })
      const replace = vi.fn()
      vi.spyOn(window, "open").mockReturnValue({ opener: window, location: { replace }, close: vi.fn() } as never)
      render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={[`/content/pages/${initial.id}`]}><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
      fireEvent.change(await screen.findByLabelText("Заголовок H1"), { target: { value: "Новый H1" } })
      fireEvent.click(screen.getByRole("button", { name: "Предпросмотр" }))

      await waitFor(() => expect(replace).toHaveBeenCalledWith(`http://localhost:4321/family?__cms_preview=${"p".repeat(40)}`))
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ publicTitle: "Новый H1" }), initial.version)
      expect(token).toHaveBeenCalledWith(saved.id, saved.version)
      expect(save.mock.invocationCallOrder[0]).toBeLessThan(token.mock.invocationCallOrder[0]!)
    } finally {
      Object.assign(cmsRepository, { mode: originalMode })
    }
  })

  it("shows active publication separately from an earlier published revision", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111", hasPublishedRevision: true }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    vi.spyOn(cmsRepository, "getPublicationStatus").mockResolvedValue({ active: false, path: null, revisionId: null, activeReleaseId: "22222222-2222-4222-8222-222222222222", activeReleaseVersion: 7 })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    expect(await screen.findByText("Не в активной публикации")).toBeInTheDocument()
  })

  it("shows the actual published URL when it differs from the draft URL", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111", url: "/family-new" }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    vi.spyOn(cmsRepository, "getPublicationStatus").mockResolvedValue({ active: true, path: "/family", revisionId: "33333333-3333-4333-8333-333333333333", activeReleaseId: "22222222-2222-4222-8222-222222222222", activeReleaseVersion: 7 })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    expect(await screen.findByText("В активной публикации")).toBeInTheDocument()
    expect(screen.getByText("Публичный URL: /family")).toBeInTheDocument()
  })

  it("confirms the current public URL before unpublishing and keeps an unsaved draft", async () => {
    const user = userEvent.setup()
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111", status: "published" as const }
    let active = true
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    vi.spyOn(cmsRepository, "getPublicationStatus").mockImplementation(async () => ({ active, path: active ? "/family" : null, revisionId: active ? "33333333-3333-4333-8333-333333333333" : null, activeReleaseId: "22222222-2222-4222-8222-222222222222", activeReleaseVersion: active ? 7 : 8 }))
    const unpublish = vi.spyOn(cmsRepository, "unpublish").mockImplementation(async () => { active = false })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    fireEvent.change(await screen.findByLabelText("Заголовок H1"), { target: { value: "Несохранённый заголовок" } })
    await screen.findByText("В активной публикации")

    await user.click(screen.getAllByRole("button", { name: "Ещё" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Снять с сайта" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Адрес /family исчезнет из карты сайта")))
    expect(unpublish).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await user.click(screen.getAllByRole("button", { name: "Ещё" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Снять с сайта" }))
    await waitFor(() => expect(unpublish).toHaveBeenCalledWith(initial.id, initial.version, expect.objectContaining({ active: true, activeReleaseVersion: 7 })))
    expect(await screen.findByText("Не в активной публикации")).toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок H1")).toHaveValue("Несохранённый заголовок")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
  })

  it("asks once when closing a dirty editor through its own Back action", async () => {
    // React Router creates a Node Request in jsdom; its signal must share that realm.
    vi.stubGlobal("AbortController", transferableAbortController().constructor)
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111" }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    const router = createMemoryRouter([
      { path: "/content/pages/:nodeId", element: <ContentEditorPage kind="landing" nodeId={initial.id} returnTo="/list" /> },
      { path: "/list", element: <h1>Список страниц</h1> },
    ], { initialEntries: [`/content/pages/${initial.id}`] })
    render(<TooltipProvider><AdminAuthSessionProvider><RouterProvider router={router} /></AdminAuthSessionProvider></TooltipProvider>)
    fireEvent.change(await screen.findByLabelText("Заголовок H1"), { target: { value: "Мой заголовок" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Закрыть" })[0]!)
    expect(await screen.findByRole("heading", { name: "Список страниц" })).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledOnce()
  })

  it("keeps the saved ID/version when publication preflight fails and retries without creating a duplicate", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "new", version: 1, revision: 0 }
    const saved = { ...initial, id: "11111111-1111-4111-8111-111111111111", version: 2, revision: 1 }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const save = vi.spyOn(cmsRepository, "saveEditor").mockResolvedValue(saved)
    const preview = vi.spyOn(cmsRepository, "getPublicationPreview").mockRejectedValue(new Error("Preflight временно недоступен"))

    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={["/content/pages/new"]}><ContentEditorPage kind="landing" /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    fireEvent.click(await screen.findByRole("button", { name: "Сохранить и опубликовать" }))
    await screen.findByText("Preflight временно недоступен")

    expect(save).toHaveBeenCalledOnce()
    expect(preview).toHaveBeenLastCalledWith(saved.id)
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }))
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenCalledOnce()
  })

  it("keeps an unsupported revision schema read-only", async () => {
    const unsupported = { ...structuredClone(editorFixtures["landing-family"]!), schemaVersion: 2 }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(unsupported)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={unsupported.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    expect(await screen.findByText("Новая версия формата")).toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок H1")).toHaveAttribute("readonly")
  })

  it("rebases only local field changes onto the fresh server revision after a conflict", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "11111111-1111-4111-8111-111111111111", version: 1 }
    const server = { ...initial, version: 2, description: "Описание из другой вкладки" }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValueOnce(initial).mockResolvedValueOnce(server)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue([])
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    vi.spyOn(cmsRepository, "saveEditor").mockRejectedValue(new CmsConflictError(2))
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)

    fireEvent.change(await screen.findByLabelText("Заголовок H1"), { target: { value: "Мой локальный H1" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))
    await screen.findByText("Страница уже изменена в другой вкладке")
    fireEvent.click(screen.getByRole("button", { name: "Сверить с сервером" }))

    await screen.findByText(/Загружена серверная версия 2/)
    expect(screen.getByLabelText("Заголовок H1")).toHaveValue("Мой локальный H1")
    expect(screen.getByLabelText("Описание и назначение")).toHaveValue("Описание из другой вкладки")
  })

  it("applies a query parent once, preserves a manual choice, and reacts to a changed query", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "new", parentNodeId: null, hasPublishedRevision: false }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue(nodeFixtures)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={["/content/pages/new?parentNodeId=houses"]}><ContentEditorPage kind="landing" /><QueryParentControl parentNodeId="home" /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    const parent = await screen.findByLabelText("Родительский раздел")
    await waitFor(() => expect(parent).toHaveValue("houses"))

    fireEvent.change(parent, { target: { value: "programs" } })
    fireEvent.change(screen.getByLabelText("Заголовок H1"), { target: { value: "Новый заголовок" } })
    await waitFor(() => expect(parent).toHaveValue("programs"))

    fireEvent.click(screen.getByRole("button", { name: "Parent query: home" }))
    await waitFor(() => expect(parent).toHaveValue("home"))
  })

  it("shows a missing query parent error without changing the draft placement", async () => {
    const initial = { ...structuredClone(editorFixtures["landing-family"]!), id: "new", parentNodeId: null, hasPublishedRevision: false }
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue(nodeFixtures)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={["/content/pages/new?parentNodeId=missing"]}><ContentEditorPage kind="landing" /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)

    expect(await screen.findByText("Выбранный родительский раздел не найден или архивирован.")).toBeInTheDocument()
    expect(screen.getByLabelText("Родительский раздел")).toHaveValue("")
  })

  it("confirms archive with local changes and remains dirty when archive fails", async () => {
    const user = userEvent.setup()
    const initial = structuredClone(editorFixtures["landing-family"]!)
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue(nodeFixtures)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const archive = vi.spyOn(cmsRepository, "archive").mockRejectedValue(new Error("Archive failed"))
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    fireEvent.change(await screen.findByLabelText("Заголовок H1"), { target: { value: "Несохранённый H1" } })

    await user.click(screen.getAllByRole("button", { name: "Ещё" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Архивировать" }))
    expect(confirm).toHaveBeenCalledWith("Архивировать «Отдых с детьми»? История редакций сохранится. Архивирование не снимает страницу с сайта, если она уже опубликована. Несохранённые изменения будут потеряны.")
    expect(archive).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await user.click(screen.getAllByRole("button", { name: "Ещё" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Архивировать" }))
    expect(await screen.findByText("Archive failed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    expect(archive).toHaveBeenCalledOnce()
  })

  it("confirms archive even when the editor has no local changes", async () => {
    const user = userEvent.setup()
    const initial = structuredClone(editorFixtures["landing-family"]!)
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getNodes").mockResolvedValue(nodeFixtures)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const archive = vi.spyOn(cmsRepository, "archive")
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><ContentEditorPage kind="landing" nodeId={initial.id} /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)

    await screen.findByLabelText("Заголовок H1")
    await user.click(screen.getAllByRole("button", { name: "Ещё" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Архивировать" }))

    expect(confirm).toHaveBeenCalledWith("Архивировать «Отдых с детьми»? История редакций сохранится. Архивирование не снимает страницу с сайта, если она уже опубликована.")
    expect(archive).not.toHaveBeenCalled()
  })
})

function QueryParentControl({ parentNodeId }: { parentNodeId: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(`?parentNodeId=${parentNodeId}`, { replace: true })}>Parent query: {parentNodeId}</button>
}
