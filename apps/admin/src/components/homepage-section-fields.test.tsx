import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HomepageSectionFields } from "./homepage-section-fields"
import { createHomepageSectionEditorSection } from "@admin/data/homepage-section"

function Harness({ editable = true }: { editable?: boolean }) {
  const [value, setValue] = useState(createHomepageSectionEditorSection("events").homepageConfig!)
  return <HomepageSectionFields id="events" value={value} editable={editable} onChange={setValue} />
}

describe("homepage section fields", () => {
  it("edits the shared editorial fields and CTA", async () => {
    const user = userEvent.setup(); render(<Harness />)
    await user.type(screen.getByLabelText("Заголовок секции"), " из CMS")
    await user.type(screen.getByLabelText("Описание секции"), " Текст")
    await user.type(screen.getByLabelText("CTA · подпись"), "Все события")
    await user.clear(screen.getByLabelText("CTA · путь"))
    await user.type(screen.getByLabelText("CTA · путь"), "/events")
    expect(screen.queryByText("Перед публикацией")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок секции")).toHaveValue("События из CMS")
    expect(screen.getByLabelText("CTA · путь")).toHaveValue("/events")
  })

  it("shows an explicit draft warning and disables mutations without edit capability", async () => {
    const user = userEvent.setup(); render(<Harness editable={false} />)
    expect(screen.queryByText("Перед публикацией")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок секции")).toBeDisabled()
    await user.click(screen.getByLabelText("Заголовок секции"))
    expect(screen.getByLabelText("Заголовок секции")).toHaveValue("События")
  })
})
