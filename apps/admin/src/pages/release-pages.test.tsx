import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { cmsRepository } from "@admin/data/cms-repository"
import { ReleasesPage } from "./release-pages"

describe("ReleasesPage", () => {
  afterEach(() => vi.restoreAllMocks())

  it("guides the first publication from an empty journal without a manual release action", async () => {
    vi.spyOn(cmsRepository, "getReleases").mockResolvedValue([])
    render(<MemoryRouter><ReleasesPage /></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Публикаций пока нет" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Проверьте настройки сайта" })).toHaveAttribute("href", "/settings/site")
    expect(screen.getByRole("link", { name: "Откройте страницы сайта" })).toHaveAttribute("href", "/content/tree")
    expect(screen.getByText(/собирать релиз вручную не нужно/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Активировать/ })).not.toBeInTheDocument()
  })
})
