import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HomeOfferingsField } from "./home-offerings-field"

const choices = [
  { offeringId: "11111111-1111-4111-8111-111111111111", title: "Сосновый домик", state: "active" as const },
  { offeringId: "22222222-2222-4222-8222-222222222222", title: "Домик у озера", state: "draft" as const },
]
vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getHomeOfferingChoices: () => Promise.resolve(choices) } }))

it("switches to manual choice, saves order and keeps unavailable selected IDs visible", async () => {
  const user = userEvent.setup()
  function Harness() {
    const [ids, setIds] = useState<string[] | undefined>()
    return <HomeOfferingsField kind="house" ids={ids} editable onChange={setIds} />
  }
  render(<Harness />)
  await user.click(screen.getByRole("button", { name: "Включить ручной выбор" }))
  await user.click(await screen.findByRole("button", { name: "Добавить Сосновый домик" }))
  await user.click(screen.getByRole("button", { name: "Добавить Домик у озера" }))
  const selected = within(screen.getByLabelText("Выбранные домики"))
  expect(selected.getAllByRole("button", { name: /Убрать/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Убрать Сосновый домик", "Убрать Домик у озера"])
  await user.click(screen.getByRole("button", { name: "Поднять Домик у озера" }))
  expect(selected.getAllByRole("button", { name: /Убрать/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Убрать Домик у озера", "Убрать Сосновый домик"])
  expect(selected.getByText("Черновик CRM")).toBeInTheDocument()
})
