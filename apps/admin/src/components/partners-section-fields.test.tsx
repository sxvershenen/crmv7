import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PartnersSectionFields } from "./partners-section-fields"
import { createPartnersEditorSection } from "@admin/data/partners-section"

function Harness({ editable = true }: { editable?: boolean }) {
  const [value, setValue] = useState(createPartnersEditorSection().partnersConfig!)
  return <PartnersSectionFields id="partners" value={value} editable={editable} onChange={setValue} />
}

describe("partner fields", () => {
  it("edits, reorders and removes items with accessible controls", async () => {
    const user = userEvent.setup(); render(<Harness />)
    expect(screen.getByText("Перед публикацией")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Добавить партнёра" }))
    await user.type(screen.getByLabelText("Название партнёра 1"), "Пекарня")
    await user.click(screen.getByRole("button", { name: "Добавить партнёра" }))
    await user.type(screen.getByLabelText("Название партнёра 2"), "Кофейня")
    await user.click(screen.getByRole("button", { name: "Поднять партнёра 2" }))
    expect(screen.getByLabelText("Название партнёра 1")).toHaveValue("Кофейня")
    expect(screen.getByRole("button", { name: "Поднять партнёра 1" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Удалить партнёра 2" }))
    expect(screen.queryByLabelText("Название партнёра 2")).not.toBeInTheDocument()
    expect(screen.queryByText("Перед публикацией")).not.toBeInTheDocument()
  })
  it("disables all mutations without edit capability", async () => {
    const user = userEvent.setup(); render(<Harness editable={false} />)
    expect(screen.getByLabelText("Заголовок секции")).toBeDisabled()
    const add = screen.getByRole("button", { name: "Добавить партнёра" })
    expect(add).toBeDisabled(); await user.click(add)
    expect(screen.queryByLabelText("Название партнёра 1")).not.toBeInTheDocument()
  })
})
