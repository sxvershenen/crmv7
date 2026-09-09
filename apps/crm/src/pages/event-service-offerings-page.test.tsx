import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { EventServiceOfferingWorkspace } from "@crm/offering-editor"

import { FixtureEventServiceRepository } from "@app/data/event-services-repository"
import { EventServiceOfferingEditorPage } from "@app/pages/event-service-offering-editor-page"
import { EventServiceOfferingsPage } from "@app/pages/event-service-offerings-page"

const templateId = "22222222-2222-4222-8222-222222222222"
const offeringId = "33333333-3333-4333-8333-333333333333"

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
    fireEvent.change(duration, { target: { value: "300" } })
    await user.click(screen.getByRole("button", { name: "Сохранить формат" }))
    expect(await screen.findByText("Данные изменились на сервере")).toBeInTheDocument()
    const firstCommand = updateTemplate.mock.calls[0]?.[1]
    await user.click(screen.getByRole("button", { name: "Повторить" }))
    expect(updateTemplate.mock.calls[1]?.[1]).toEqual(firstCommand)
  })
})
