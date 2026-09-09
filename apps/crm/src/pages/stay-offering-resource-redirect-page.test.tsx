import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"
import type { InternalOfferingEditor } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"

import { StayOfferingResourceRedirectPage } from "./stay-offering-resource-redirect-page"

function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output> }
function renderRoute(entry: string, gateway: Pick<OfferingEditorGateway, "getHouseEditor" | "getCampgroundEditor">) {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes>
    <Route element={<StayOfferingResourceRedirectPage gateway={gateway} />} path="/offers/houses/:offeringId" />
    <Route element={<StayOfferingResourceRedirectPage gateway={gateway} />} path="/offers/campgrounds/:offeringId" />
    <Route element={<LocationProbe />} path="/resources/:kind/:resourceId" />
    <Route element={<LocationProbe />} path="/resources/:kind" />
  </Routes></MemoryRouter></TooltipProvider>)
}

type GatewayMock = Pick<OfferingEditorGateway, "getHouseEditor" | "getCampgroundEditor"> & {
  getHouseEditor: ReturnType<typeof vi.fn>
  getCampgroundEditor: ReturnType<typeof vi.fn>
}

function gatewayMock(): GatewayMock {
  return { getHouseEditor: vi.fn(), getCampgroundEditor: vi.fn() } as unknown as GatewayMock
}

function editor(kind: "house" | "campground", options: { archived?: boolean; primaryCount?: number; targetKind?: string } = {}) {
  const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const primary = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", offeringId: "11111111-1111-4111-8111-111111111111", version: 1, target: { type: "resource" as const, id: resourceId }, role: "primary" as const, availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }
  return {
    offering: { kind },
    bindings: Array.from({ length: options.primaryCount ?? 1 }, (_, index) => ({ ...primary, id: `${index}` })),
    bindingTargets: [{ type: "resource", id: resourceId, kind: options.targetKind ?? (kind === "house" ? "houses" : "camping"), archived: options.archived ?? false }],
  } as unknown as InternalOfferingEditor
}

describe("StayOfferingResourceRedirectPage", () => {
  it("replaces a house offering URL with its Resource sale tab", async () => {
    const gateway = gatewayMock()
    gateway.getHouseEditor.mockResolvedValue(editor("house"))
    renderRoute("/offers/houses/11111111-1111-4111-8111-111111111111", gateway)
    expect(await screen.findByTestId("location")).toHaveTextContent("/resources/houses/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=offering")
    expect(gateway.getHouseEditor).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111")
  })

  it("uses the campground gateway and campsite Resource route", async () => {
    const gateway = gatewayMock()
    gateway.getCampgroundEditor.mockResolvedValue(editor("campground"))
    renderRoute("/offers/campgrounds/11111111-1111-4111-8111-111111111111", gateway)
    expect(await screen.findByTestId("location")).toHaveTextContent("/resources/camping/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?tab=offering")
    expect(gateway.getCampgroundEditor).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["missing", null],
    ["ambiguous", editor("house", { primaryCount: 2 })],
    ["archived", editor("house", { archived: true })],
    ["wrong kind", editor("house", { targetKind: "venue" })],
  ])("fails closed for a %s primary binding", async (_case, result) => {
    const gateway = gatewayMock()
    gateway.getHouseEditor.mockResolvedValue(result)
    renderRoute("/offers/houses/11111111-1111-4111-8111-111111111111", gateway)
    expect(await screen.findByText("Старая ссылка не ведёт к ресурсу")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "К списку домиков" })).toBeInTheDocument()
    expect(screen.queryByTestId("location")).not.toBeInTheDocument()
  })

  it("fails closed when the editor request cannot be verified", async () => {
    const gateway = gatewayMock()
    gateway.getHouseEditor.mockRejectedValue(new Error("offline"))
    renderRoute("/offers/houses/11111111-1111-4111-8111-111111111111", gateway)
    expect(await screen.findByText("Старая ссылка не проверена")).toBeInTheDocument()
  })
})
