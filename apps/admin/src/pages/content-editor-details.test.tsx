import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@crm/ui"
import { ContentEditorPage } from "./content-editor-page"

vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: {} } }) }))

it("edits and saves homepage reviews and FAQ through the composition editor", async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={["/content/home?tab=composition"]}><TooltipProvider><ContentEditorPage kind="home" /></TooltipProvider></MemoryRouter>)
  await user.click(await screen.findByRole("button", { name: "Добавить секцию «Отзывы»" }))
  await user.click(screen.getByRole("button", { name: "Добавить отзыв" }))
  await user.type(screen.getByLabelText("Имя автора 1"), "Гость из CMS")
  await user.type(screen.getByLabelText("Текст отзыва 1"), "Отзыв из CMS")
  await user.click(screen.getByRole("button", { name: "Добавить секцию «Вопросы и ответы»" }))
  await user.click(screen.getByRole("button", { name: "Добавить вопрос" }))
  await user.type(screen.getByLabelText("Вопрос 1"), "Вопрос из CMS?")
  await user.type(screen.getByLabelText("Ответ 1"), "Ответ из CMS")
  await user.click(screen.getByRole("button", { name: "Сохранить" }))
  await screen.findByText("Сохранено", { exact: true })
  expect(screen.getByLabelText("Имя автора 1")).toHaveValue("Гость из CMS")
  expect(screen.getByLabelText("Ответ 1")).toHaveValue("Ответ из CMS")
})
