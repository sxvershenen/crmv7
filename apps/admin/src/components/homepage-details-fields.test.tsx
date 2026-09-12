import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HomepageSectionFields } from "./homepage-section-fields"
import { createHomepageSectionEditorSection } from "@admin/data/homepage-section"

function Harness({ sectionKey, editable = true }: { sectionKey: "reviews" | "faq"; editable?: boolean }) {
  const [value, setValue] = useState(createHomepageSectionEditorSection(sectionKey).homepageConfig!)
  return <HomepageSectionFields id={sectionKey} sectionKey={sectionKey} value={value} editable={editable} onChange={setValue} />
}

describe("homepage details fields", () => {
  it.each(["reviews", "faq"] as const)("adds, edits, reorders and removes %s", async (sectionKey) => {
    const user = userEvent.setup(); render(<Harness sectionKey={sectionKey} />)
    const reviews = sectionKey === "reviews"
    const noun = reviews ? "отзыв" : "вопрос"
    const label = reviews ? "Имя автора" : "Вопрос"
    const body = reviews ? "Текст отзыва" : "Ответ"
    expect(screen.getByText("Список пуст — секция будет скрыта на сайте.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: `Добавить ${noun}` }))
    expect(screen.getByText("Перед публикацией")).toBeInTheDocument()
    await user.type(screen.getByLabelText(`${label} 1`), "Первый")
    await user.type(screen.getByLabelText(`${body} 1`), "Первый текст")
    if (reviews) {
      await user.selectOptions(screen.getByLabelText("Оценка отзыва 1"), "4")
      expect(screen.getByLabelText("Оценка отзыва 1")).toHaveValue("4")
    }
    expect(screen.queryByText("Перед публикацией")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: `Добавить ${noun}` }))
    await user.type(screen.getByLabelText(`${label} 2`), "Второй")
    await user.click(screen.getByRole("button", { name: `Поднять ${noun} 2` }))
    expect(screen.getByLabelText(`${label} 1`)).toHaveValue("Второй")
    expect(screen.getByRole("button", { name: `Поднять ${noun} 1` })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: `Удалить ${noun} 1` }))
    expect(screen.getByLabelText(`${label} 1`)).toHaveValue("Первый")
    await user.click(screen.getByRole("button", { name: `Удалить ${noun} 1` }))
    expect(screen.getByText("Список пуст — секция будет скрыта на сайте.")).toBeInTheDocument()
  })
  it.each(["reviews", "faq"] as const)("disables %s editing without capability", async (sectionKey) => {
    render(<Harness sectionKey={sectionKey} editable={false} />)
    expect(screen.getByRole("button", { name: sectionKey === "reviews" ? "Добавить отзыв" : "Добавить вопрос" })).toBeDisabled()
  })
})
