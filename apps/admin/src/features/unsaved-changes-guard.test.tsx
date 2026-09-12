import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, Link, MemoryRouter, RouterProvider } from "react-router-dom"

import { UnsavedChangesGuard } from "./unsaved-changes-guard"
import { confirmUnsavedChanges } from "./unsaved-changes-registry"

describe("UnsavedChangesGuard", () => {
  it("blocks SPA navigation until the editor confirms leaving", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const router = createMemoryRouter([
      { path: "/edit", element: <><UnsavedChangesGuard when /><Link to="/next">В другой раздел</Link></> },
      { path: "/next", element: <p>Следующий раздел</p> },
    ], { initialEntries: ["/edit"] })
    render(<RouterProvider router={router} />)

    fireEvent.click(screen.getByRole("link", { name: "В другой раздел" }))
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
    expect(router.state.location.pathname).toBe("/edit")
    await waitFor(() => expect([...router.state.blockers.values()].every((blocker) => blocker.state === "unblocked")).toBe(true))

    expect(screen.queryByText("Следующий раздел")).not.toBeInTheDocument()
  })

  it("stays compatible with declarative MemoryRouter page harnesses", () => {
    render(<MemoryRouter><UnsavedChangesGuard when={false} /><p>Редактор</p></MemoryRouter>)
    expect(screen.getByText("Редактор")).toBeInTheDocument()
  })

  it("exposes the same confirmation to non-router actions such as logout", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<MemoryRouter><UnsavedChangesGuard when /></MemoryRouter>)
    await waitFor(() => expect(confirmUnsavedChanges("Выйти?")).toBe(false))
    expect(confirm).toHaveBeenCalledWith("Выйти?")
  })
})
