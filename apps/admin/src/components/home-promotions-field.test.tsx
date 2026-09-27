import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { promotionFixtures } from "@admin/fixtures/cms"
import { HomePromotionsField } from "./home-promotions-field"

vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getPromotions: () => Promise.resolve(promotionFixtures) } }))

it("selects, orders and removes CRM promotions in the homepage editor", async () => {
  const user = userEvent.setup()
  function Harness() {
    const [ids, setIds] = useState<string[]>([])
    return <HomePromotionsField editable ids={ids} onChange={setIds} />
  }
  render(<Harness />)
  await user.click(await screen.findByRole("button", { name: "Выбрать промокод AUTUMN15" }))
  await user.click(screen.getByRole("button", { name: "Выбрать промокод WEEKDAY3000" }))
  const selected = within(screen.getByLabelText("Выбранные промокоды"))
  expect(selected.getAllByText(/AUTUMN15|WEEKDAY3000/).map((element) => element.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("AUTUMN15"), expect.stringContaining("WEEKDAY3000")]))
  await user.click(screen.getByRole("button", { name: "Поднять промокод WEEKDAY3000" }))
  expect(selected.getAllByRole("button", { name: /Убрать промокод/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Убрать промокод WEEKDAY3000", "Убрать промокод AUTUMN15"])
  await user.click(screen.getByRole("button", { name: "Убрать промокод WEEKDAY3000" }))
  expect(selected.getAllByRole("button", { name: /Убрать промокод/ })).toHaveLength(1)
})
