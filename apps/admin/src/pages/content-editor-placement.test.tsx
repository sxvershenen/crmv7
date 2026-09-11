import { fireEvent, render, screen } from "@testing-library/react"

import { editorFixtures, nodeFixtures } from "@admin/fixtures/cms"
import { EditorTabContent } from "@admin/pages/content-editor-page"

const noopSection = vi.fn()

describe("content editor route placement", () => {
  it("disables slug and parent moves for a published route", () => {
    const draft = { ...editorFixtures["house-lesnoy"]!, hasPublishedRevision: true, parentNodeId: "houses", sortOrder: 10 }
    render(<EditorTabContent device="desktop" draft={draft} editable kind="profile" nodes={nodeFixtures} tab="content" update={vi.fn()} updateSection={noopSection} />)

    expect(screen.getByLabelText("Slug")).toHaveProperty("readOnly", true)
    expect(screen.getByLabelText("Родительский раздел")).toBeDisabled()
    expect(screen.getByText(/redirect workflow/)).toBeInTheDocument()
  })

  it("disables route controls for a branch even when it was never published", () => {
    const draft = { ...editorFixtures["landing-family"]!, hasPublishedRevision: false, parentNodeId: "home", sortOrder: 30 }
    const nodes = [...nodeFixtures, { ...nodeFixtures[4]!, id: "child", parentId: draft.id, path: "/family/child", title: "Child" }]
    render(<EditorTabContent device="desktop" draft={draft} editable kind="landing" nodes={nodes} tab="content" update={vi.fn()} updateSection={noopSection} />)

    expect(screen.getByLabelText("Slug")).toHaveProperty("readOnly", true)
    expect(screen.getByLabelText("Родительский раздел")).toBeDisabled()
    expect(screen.getByText(/atomic subtree move/)).toBeInTheDocument()
  })

  it("computes a child URL and bounded end placement from the selected parent", () => {
    const update = vi.fn()
    const draft = { ...editorFixtures["landing-family"]!, id: "new", slug: "summer", url: "/summer", hasPublishedRevision: false, parentNodeId: null, sortOrder: 10 }
    render(<EditorTabContent device="desktop" draft={draft} editable kind="landing" nodes={nodeFixtures} tab="content" update={update} updateSection={noopSection} />)

    fireEvent.change(screen.getByLabelText("Родительский раздел"), { target: { value: "houses" } })

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ parentNodeId: "houses", parent: "Домики", sortOrder: 30, url: "/domiki/summer" }))
  })
})
