import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WhyUsSectionFields } from "./why-us-section-fields"
import { createWhyUsEditorSection } from "@admin/data/why-us-section"

function Harness({ editable = true }: { editable?: boolean }) {
  const [value, setValue] = useState(createWhyUsEditorSection().whyUsConfig!)
  return <WhyUsSectionFields id="why-us" value={value} editable={editable} onChange={setValue} />
}

describe("why-us fields", () => {
  it("edits, reorders and removes facts with accessible controls", async () => {
    const user = userEvent.setup(); render(<Harness />)
    expect(screen.getByText("Перед публикацией")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Заголовок секции"), " для гостей")
    await user.type(screen.getByLabelText("Заголовок", { selector: "input" }), " Рядом")
    await user.type(screen.getAllByLabelText(/^Описание$/, { selector: "textarea" })[0]!, " Помогаем")
    await user.click(screen.getByRole("button", { name: "Добавить факт" }))
    await user.type(screen.getByLabelText("Акцент факта 1"), "9 мин")
    await user.type(screen.getByLabelText("Название", { selector: "input" }), "От центра")
    await user.type(screen.getAllByLabelText(/^Описание$/, { selector: "textarea" }).at(-1)!, "Удобно")
    expect(screen.queryByText("Перед публикацией")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Добавить факт" }))
    await user.type(screen.getByLabelText("Акцент факта 2"), "24 га")
    await user.type(screen.getAllByLabelText("Название", { selector: "input" }).at(-1)!, "Леса")
    await user.type(screen.getAllByLabelText(/^Описание$/, { selector: "textarea" }).at(-1)!, "Природа")
    await user.click(screen.getByRole("button", { name: "Поднять факт 2" }))
    expect(screen.getByLabelText("Акцент факта 1")).toHaveValue("24 га")
    await user.click(screen.getByRole("button", { name: "Удалить факт 2" }))
    expect(screen.queryByLabelText("Акцент факта 2")).not.toBeInTheDocument()
  })

  it("disables all mutations without edit capability", async () => {
    const user = userEvent.setup(); render(<Harness editable={false} />)
    expect(screen.getByLabelText("Заголовок секции")).toBeDisabled()
    const add = screen.getByRole("button", { name: "Добавить факт" })
    expect(add).toBeDisabled(); await user.click(add)
    expect(screen.queryByLabelText("Акцент факта 1")).not.toBeInTheDocument()
  })
})
