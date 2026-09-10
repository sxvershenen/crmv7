import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { EventServiceOfferingWorkspace } from "@crm/offering-editor"

import { FixtureEventServiceRepository } from "@app/data/event-services-repository"
import { EventServiceOfferingEditorPage } from "@app/pages/event-service-offering-editor-page"
import { EventServiceOfferingsPage } from "@app/pages/event-service-offerings-page"

const templateId = "22222222-2222-4222-8222-222222222222"
const offeringId = "33333333-3333-4333-8333-333333333333"

function CategoryRouteChanger({ templateId: nextTemplateId, offeringId: nextOfferingId }: { templateId: string; offeringId: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(`/events/categories/${nextOfferingId}`, { state: { templateId: nextTemplateId } })}>Открыть другую категорию</button>
}

function renderRoutes(repository: FixtureEventServiceRepository, initialEntries: NonNullable<Parameters<typeof MemoryRouter>[0]["initialEntries"]>) {
  return render(<TooltipProvider><MemoryRouter initialEntries={initialEntries}><Routes>
    <Route element={<EventServiceOfferingsPage repository={repository} />} path="/events/categories" />
    <Route element={<EventServiceOfferingEditorPage repository={repository} />} path="/events/categories/:offeringId" />
  </Routes></MemoryRouter></TooltipProvider>)
}

describe("CRM event categories workspace", () => {
  it("uses the category route and does not expose template technical codes", async () => {
    const repository = new FixtureEventServiceRepository()
    renderRoutes(repository, ["/events/categories"])

    expect(await screen.findByRole("heading", { name: "Категории мероприятий" })).toBeInTheDocument()
    expect(screen.getByText("Категория мероприятия")).toBeInTheDocument()
    expect(screen.queryByText("wedding_standard")).not.toBeInTheDocument()
  })

  it("opens the linked category dossier through the same route and keeps public readiness closed", async () => {
    const repository = new FixtureEventServiceRepository()
    renderRoutes(repository, [{ pathname: `/events/categories/${offeringId}`, state: { templateId } }])

    expect((await screen.findAllByText("Свадебное мероприятие")).length).toBeGreaterThan(0)
    expect(screen.getByText("Категория мероприятия")).toBeInTheDocument()
    expect(screen.getByText("Public закрыт")).toBeInTheDocument()
    expect(screen.queryByText(templateId)).not.toBeInTheDocument()
    expect(screen.queryByText("wedding_standard")).not.toBeInTheDocument()
  })

  it("does not map a legacy category id to a commercial category accidentally", async () => {
    renderRoutes(new FixtureEventServiceRepository(), [`/events/categories/${templateId}`])

    expect(await screen.findByText("Категория не найдена")).toBeInTheDocument()
  })

  it("keeps the terms draft and retries the exact command after a CAS conflict", async () => {
    const user = userEvent.setup()
    const repository = new FixtureEventServiceRepository()
    const linked = await repository.getByTemplateId(templateId)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    expect(linked.data.editor.capabilities.subject.canEdit).toBe(true)
    const updateTemplate = vi.spyOn(repository, "updateTemplate")
      .mockRejectedValueOnce(Object.assign(new Error("Версия категории изменилась"), { status: 409 }))
      .mockResolvedValue({ template: linked.data.dossier.template, subjectVersion: 2 })
    render(<TooltipProvider><EventServiceOfferingWorkspace data={linked.data} gateway={repository} createPreviewCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })} createPricingCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: linked.data.editor.ownerVersions.pricing })} createTemplateCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: linked.data.editor.ownerVersions.subject.aggregateVersion })} onReload={async () => undefined} /></TooltipProvider>)

    const duration = (await screen.findAllByLabelText("Длительность, минут")).at(-1)!
    expect(duration).toBeEnabled()
    fireEvent.change(document.querySelector<HTMLInputElement>("#event-service-operational-name")!, { target: { value: "Обновлённая категория" } })
    fireEvent.change(screen.getByLabelText("Внутренняя заметка"), { target: { value: "Заметка CRM" } })
    fireEvent.change(duration, { target: { value: "300" } })
    await user.click(screen.getByRole("button", { name: "Сохранить формат" }))
    expect(await screen.findByText("Данные изменились на сервере")).toBeInTheDocument()
    const firstCommand = updateTemplate.mock.calls[0]?.[1]
    expect(firstCommand).toMatchObject({ operationalName: "Обновлённая категория", internalComment: "Заметка CRM", expectedOfferingVersion: 1 })
    await user.click(screen.getByRole("button", { name: "Повторить" }))
    expect(updateTemplate.mock.calls[1]?.[1]).toEqual(firstCommand)
  })

  it("keeps dirty terms while switching tabs and saving pricing", async () => {
    const user = userEvent.setup()
    const linked = await new FixtureEventServiceRepository().getByTemplateId(templateId)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    const createDraftPriceBook = vi.fn().mockResolvedValue({})
    const gateway = {
      updateTemplate: vi.fn(),
      createDraftPriceBook,
      replaceDraftPriceBook: vi.fn(),
      activatePriceBook: vi.fn(),
      schedulePriceBook: vi.fn(),
      previewQuote: vi.fn(),
    }
    render(<TooltipProvider><EventServiceOfferingWorkspace data={linked.data} gateway={gateway} createPreviewCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })} createPricingCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: linked.data.editor.ownerVersions.pricing })} createTemplateCommandMeta={() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: linked.data.editor.ownerVersions.subject.aggregateVersion })} onReload={async () => undefined} /></TooltipProvider>)

    const termsName = document.querySelector<HTMLInputElement>("#event-service-operational-name")!
    await user.clear(termsName)
    await user.type(termsName, "Свадьба с сохранёнными условиями")
    await user.click(screen.getByRole("tab", { name: "Пакеты и цены" }))
    await user.clear(screen.getByLabelText("Название прайс-листа"))
    await user.type(screen.getByLabelText("Название прайс-листа"), "Новый прайс")
    await user.click(screen.getByRole("button", { name: "Сохранить цены" }))
    await waitFor(() => expect(createDraftPriceBook).toHaveBeenCalledOnce())
    await user.click(screen.getByRole("tab", { name: "Условия" }))

    expect(document.querySelector<HTMLInputElement>("#event-service-operational-name")).toHaveValue("Свадьба с сохранёнными условиями")
  })

  it("keeps a dirty terms draft when CAS recovery performs a soft reload", async () => {
    const user = userEvent.setup()
    const repository = new FixtureEventServiceRepository()
    const linked = await repository.getByTemplateId(templateId)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    vi.spyOn(repository, "updateTemplate")
      .mockRejectedValueOnce(Object.assign(new Error("Версия категории изменилась"), { status: 409 }))
      .mockResolvedValue({ template: linked.data.dossier.template, subjectVersion: 2 })
    renderRoutes(repository, [{ pathname: `/events/categories/${offeringId}`, state: { templateId } }])

    await screen.findByDisplayValue("Свадебное мероприятие")
    const termsName = document.querySelector<HTMLInputElement>("#event-service-operational-name")!
    await user.clear(termsName)
    await user.type(termsName, "Черновик после reload")
    await user.click(screen.getByRole("button", { name: "Сохранить формат" }))
    expect(await screen.findByText("Данные изменились на сервере")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Обновить сервер" }))

    await waitFor(() => expect(document.querySelector<HTMLInputElement>("#event-service-operational-name")).toHaveValue("Черновик после reload"))
  })

  it("surfaces a failed soft reload without losing the dirty draft", async () => {
    const user = userEvent.setup()
    const repository = new FixtureEventServiceRepository()
    const linked = await repository.getByTemplateId(templateId)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    vi.spyOn(repository, "getByTemplateId")
      .mockResolvedValueOnce(linked)
      .mockRejectedValueOnce(new Error("Сервис временно недоступен"))
    vi.spyOn(repository, "updateTemplate").mockRejectedValueOnce(Object.assign(new Error("Версия категории изменилась"), { status: 409 }))
    renderRoutes(repository, [{ pathname: `/events/categories/${offeringId}`, state: { templateId } }])

    await screen.findByDisplayValue("Свадебное мероприятие")
    const termsName = document.querySelector<HTMLInputElement>("#event-service-operational-name")!
    await user.clear(termsName)
    await user.type(termsName, "Черновик при ошибке reload")
    await user.click(screen.getByRole("button", { name: "Сохранить формат" }))
    expect(await screen.findByText("Данные изменились на сервере")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Обновить сервер" }))

    expect(await screen.findByText("Сервис временно недоступен")).toBeInTheDocument()
    expect(document.querySelector<HTMLInputElement>("#event-service-operational-name")).toHaveValue("Черновик при ошибке reload")
  })

  it("resets the draft when the route switches to another category", async () => {
    const user = userEvent.setup()
    const repository = new FixtureEventServiceRepository()
    const linked = await repository.getByTemplateId(templateId)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    const nextTemplateId = "99999999-9999-4999-8999-999999999999"
    const nextOfferingId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const next = structuredClone(linked)
    next.data.dossier.template.id = nextTemplateId
    next.data.dossier.offering.id = nextOfferingId
    next.data.dossier.offering.code = "EVENT-CORPORATE"
    next.data.dossier.offering.operationalName = "Корпоративное мероприятие"
    next.data.editor.offering = { ...next.data.editor.offering, id: nextOfferingId, code: "EVENT-CORPORATE", operationalName: "Корпоративное мероприятие" }
    vi.spyOn(repository, "getByTemplateId").mockResolvedValueOnce(linked).mockResolvedValueOnce(next)
    render(<TooltipProvider><MemoryRouter initialEntries={[{ pathname: `/events/categories/${offeringId}`, state: { templateId } }]}><Routes><Route element={<><EventServiceOfferingEditorPage repository={repository} /><CategoryRouteChanger offeringId={nextOfferingId} templateId={nextTemplateId} /></>} path="/events/categories/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    await screen.findByDisplayValue("Свадебное мероприятие")
    const termsName = document.querySelector<HTMLInputElement>("#event-service-operational-name")!
    await user.clear(termsName)
    await user.type(termsName, "Черновик первой категории")
    await user.click(screen.getByRole("button", { name: "Открыть другую категорию" }))

    await waitFor(() => expect(document.querySelector<HTMLInputElement>("#event-service-operational-name")).toHaveValue("Корпоративное мероприятие"))
  })
})
