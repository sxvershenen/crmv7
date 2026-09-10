import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { InheritanceControl, SourceMarker } from "@admin/components/cms-ui"
import { editorFixtures } from "@admin/fixtures/cms"

describe("CMS compositions", () => {
  it("keeps reset disabled in readonly state and never simulates a diff", async () => {
    const user = userEvent.setup(); const onChange = vi.fn(); const section = editorFixtures.home!.sections[0]!
    render(<MemoryRouter><TooltipProvider><InheritanceControl disabled onChange={onChange} section={{ ...section, mode: "override" }} /></TooltipProvider></MemoryRouter>)
    expect(screen.getByRole("button", { name: "Показать diff" })).toBeDisabled()
    const reset = screen.getByRole("button", { name: "Сбросить" })
    expect(reset).toBeDisabled(); await user.click(reset)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("changes inheritance mode through an honest interactive control", async () => {
    const user = userEvent.setup(); const onChange = vi.fn(); const section = editorFixtures.home!.sections[0]!
    render(<MemoryRouter><TooltipProvider><InheritanceControl onChange={onChange} section={{ ...section, mode: "inherit" }} /></TooltipProvider></MemoryRouter>)
    await user.click(screen.getByRole("button", { name: "Настроить" }))
    expect(onChange).toHaveBeenCalledWith("override")
  })

  it("keeps the user label Скрыть aligned with the API disabled mode", async () => {
    const user = userEvent.setup(); const onChange = vi.fn(); const section = editorFixtures.home!.sections[0]!
    render(<MemoryRouter><TooltipProvider><InheritanceControl onChange={onChange} section={{ ...section, mode: "inherit" }} /></TooltipProvider></MemoryRouter>)
    await user.click(screen.getByRole("button", { name: "Скрыть" }))
    expect(onChange).toHaveBeenCalledWith("disabled")
  })

  it("marks CRM values as readonly authority", () => {
    render(<SourceMarker source="CRM" />)
    expect(screen.getByText("CRM · readonly")).toBeInTheDocument()
  })
})
