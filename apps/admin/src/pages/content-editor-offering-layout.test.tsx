import { render, screen } from "@testing-library/react"

import { editorFixtures, nodeFixtures } from "@admin/fixtures/cms"
import { EditorTabContent } from "@admin/pages/content-editor-page"

describe("offering content dossier layout", () => {
  it("groups identity fields and uses plain-language first-screen controls", () => {
    const draft = { ...editorFixtures["house-lesnoy"]!, hero: { ...editorFixtures["house-lesnoy"]!.hero, mode: "override" as const } }
    render(<EditorTabContent device="desktop" draft={draft} editable kind="profile" nodes={nodeFixtures} tab="content" update={vi.fn()} updateSection={vi.fn()} workspace="offering" />)

    expect(screen.getByTestId("offering-dossier")).toBeInTheDocument()
    expect(screen.getByText("Основное")).toBeInTheDocument()
    expect(screen.getByLabelText("Заголовок страницы").closest("div.sm\\:col-span-6")).toBeInTheDocument()
    expect(screen.queryByLabelText("Внутреннее имя")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Короткое описание").closest("div.sm\\:col-span-6")).toBeInTheDocument()
    expect(screen.getByText("Первый экран")).toBeInTheDocument()
    expect(screen.getByLabelText("Вариант первого экрана")).toBeInTheDocument()
    expect(screen.getByLabelText("Фокус изображения")).toBeInTheDocument()
  })
})
