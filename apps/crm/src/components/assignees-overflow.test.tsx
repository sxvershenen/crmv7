import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Assignees, TooltipProvider, type Assignee } from "@crm/ui"

const people: Assignee[] = [
  { id: "1", initials: "АА", name: "Анна Алексеева" },
  { id: "2", initials: "ББ", name: "Борис Белов" },
  { id: "3", initials: "ВВ", name: "Вера Воронова" },
  { id: "4", initials: "ГГ", name: "Галина Громова" },
  { id: "5", initials: "ДД", name: "Денис Добров" },
]

describe("Assignees overflow", () => {
  it("shows +N after three avatars and exposes the complete team in a tooltip", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><Assignees people={people} size="compact" /></TooltipProvider>)

    const overflow = screen.getByRole("img", { name: "Ещё 2 ответственных" })
    expect(overflow).toHaveTextContent("+2")
    await user.hover(overflow)
    expect(await screen.findByText("Галина Громова")).toBeInTheDocument()
    expect(screen.getByText("Денис Добров")).toBeInTheDocument()
  })
})
