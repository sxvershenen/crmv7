import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PublicEditorialContentConfig } from "@crm/contracts"

import { EditorialSectionFields } from "./editorial-section-fields"

it("edits and reorders text blocks and links without losing the draft", async () => {
  const user = userEvent.setup()
  function Editor() {
    const [value, setValue] = useState<PublicEditorialContentConfig>({ heading: null, lead: null, blocks: [], links: [] })
    return <><EditorialSectionFields editable id="body" onChange={setValue} value={value} /><output data-testid="body-value">{JSON.stringify(value)}</output></>
  }
  render(<Editor />)
  await user.click(screen.getByRole("button", { name: "Добавить абзац" }))
  await user.type(screen.getByLabelText("Текст абзаца"), "Текст страницы")
  await user.click(screen.getByRole("button", { name: "Добавить список" }))
  await user.type(screen.getByLabelText("Пункты списка · каждый с новой строки"), "Домики{enter}Программы")
  await user.click(screen.getByRole("button", { name: "Поднять блок 2" }))
  await user.click(screen.getByRole("button", { name: "Добавить ссылку" }))
  await user.type(screen.getByLabelText("Подпись ссылки 1"), "Домики")
  await user.type(screen.getByLabelText("Адрес внутри сайта"), "/domiki")
  const value = JSON.parse(screen.getByTestId("body-value").textContent ?? "{}") as PublicEditorialContentConfig
  expect(value.blocks).toEqual([{ type: "list", items: ["Домики", "Программы"] }, { type: "paragraph", text: "Текст страницы" }])
  expect(value.links).toEqual([{ label: "Домики", href: "/domiki" }])
})
