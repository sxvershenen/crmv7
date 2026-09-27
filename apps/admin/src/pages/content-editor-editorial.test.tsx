import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@crm/ui"

import { editorFixtures } from "@admin/fixtures/cms"
import { EditorTabContent } from "./content-editor-page"

it("adds the existing public text renderer to an article draft", async () => {
  const user = userEvent.setup()
  const draft = { ...structuredClone(editorFixtures["landing-family"]!), kind: "article" as const, sections: [] }
  const update = vi.fn()
  render(<MemoryRouter><TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="article" tab="composition" update={update} updateSection={vi.fn()} /></TooltipProvider></MemoryRouter>)
  await user.click(screen.getByRole("button", { name: "Добавить текст страницы" }))
  expect(update).toHaveBeenCalledWith({ sections: [expect.objectContaining({ key: "body", mode: "override", editorialConfig: { heading: null, lead: null, blocks: [], links: [] } })] })
})

it("offers the same editable text block on the homepage", async () => {
  const user = userEvent.setup()
  const draft = { ...structuredClone(editorFixtures["landing-family"]!), kind: "home" as const, sections: [] }
  const update = vi.fn()
  render(<MemoryRouter><TooltipProvider><EditorTabContent device="desktop" draft={draft} editable kind="home" tab="composition" update={update} updateSection={vi.fn()} /></TooltipProvider></MemoryRouter>)
  await user.click(screen.getByRole("button", { name: "Добавить текст страницы" }))
  expect(update).toHaveBeenCalledWith({ sections: [expect.objectContaining({ key: "body", mode: "override" })] })
})
