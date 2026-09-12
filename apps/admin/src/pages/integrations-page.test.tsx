import { extractMetrikaCounterId } from "@admin/lib/metrika-settings"

describe("extractMetrikaCounterId", () => {
  it("accepts a pasted numeric counter ID", () => {
    expect(extractMetrikaCounterId(" 12345678 ")).toBe("12345678")
  })

  it("extracts the ID from the standard Yandex snippet", () => {
    expect(extractMetrikaCounterId(`<script>ym(12345678, "init", { id: 12345678 });</script>`)).toBe("12345678")
    expect(extractMetrikaCounterId(`<noscript><img src="https://mc.yandex.ru/watch/12345678" /></noscript>`)).toBe("12345678")
  })

  it("rejects ambiguous or non-numeric input", () => {
    expect(extractMetrikaCounterId(`<script>ym(12345678, "init", { id: 87654321 });</script>`)).toBeNull()
    expect(extractMetrikaCounterId("<script>alert('nope')</script>")).toBeNull()
  })
})
