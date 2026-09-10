import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@crm/ui"
import { ContentEditorPage, EditorTabContent } from "./content-editor-page"
import { editorFixtures } from "@admin/fixtures/cms"

vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: {} } }) }))

describe("partners composition in the home editor", () => {
  it("opens the real home composition tab and adds editable partner fields", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={["/content/home?tab=composition"]}><TooltipProvider><ContentEditorPage kind="home" /></TooltipProvider></MemoryRouter>)
    await user.click(await screen.findByRole("button", { name: "Добавить секцию «Партнёры»" }))
    expect(screen.getByLabelText("Заголовок секции")).toHaveValue("Наши партнёры")
    await user.click(screen.getByRole("button", { name: "Добавить партнёра" }))
    await user.type(screen.getByLabelText("Название партнёра 1"), "Пекарня")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    await screen.findByText("Сохранено", { exact: true })
    expect(screen.getByLabelText("Название партнёра 1")).toHaveValue("Пекарня")
  })
  it("keeps unknown partners configuration readonly, including reset and mode", async () => {
    const update = vi.fn(); const updateSection = vi.fn()
    const draft = { ...editorFixtures.home!, sections: [{ id: "partners", key: "partners", label: "Партнёры", description: "Неизвестная версия", mode: "override" as const, source: "Эта страница", sourceHref: "?tab=composition", effectiveTitle: "Партнёры" }] }
    render(<MemoryRouter><TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="home" tab="composition" update={update} updateSection={updateSection} /></TooltipProvider></MemoryRouter>)
    expect(screen.getByRole("button", { name: "Сбросить" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Скрыть" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Добавить секцию «Партнёры»" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Заголовок секции")).not.toBeInTheDocument()
  })
})
