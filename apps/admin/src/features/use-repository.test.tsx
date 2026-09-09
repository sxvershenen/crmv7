import { act, renderHook, waitFor } from "@testing-library/react"

import { useRepository } from "@admin/features/use-repository"

describe("useRepository", () => {
  it("keeps the typed cause and supports an explicit safe reload", async () => {
    const failure = new Error("API unavailable")
    const loader = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce({ id: "node-1" })
    const { result } = renderHook(() => useRepository(loader))

    await waitFor(() => expect(result.current.error).toBe("API unavailable"))
    expect(result.current.cause).toBe(failure)

    await act(async () => result.current.reload())
    await waitFor(() => expect(result.current.data).toEqual({ id: "node-1" }))
    expect(result.current.error).toBeUndefined()
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
