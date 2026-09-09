import { describe, expect, it } from "vitest"

import { getQuickCreateItems, getSectionTitle } from "./navigation"

describe("getSectionTitle", () => {
  it("does not let the root route shadow operational breadcrumbs", () => {
    expect(getSectionTitle("/")).toBe("Обзор")
    expect(getSectionTitle("/leads")).toBe("Заявки")
    expect(getSectionTitle("/bookings/1048")).toBe("Бронирования")
    expect(getSectionTitle("/profile")).toBe("Профиль")
    expect(getSectionTitle("/team")).toBe("Команда")
    expect(getSectionTitle("/settings")).toBe("Настройки CRM")
    expect(getSectionTitle("/marketing/promotions/new")).toBe("Маркетинг")
    expect(getSectionTitle("/customers")).toBe("Клиенты")
    expect(getSectionTitle("/resources/houses/house-pine")).toBe("Домики")
    expect(getSectionTitle("/resources/bath")).toBe("Баня и чан")
    expect(getSectionTitle("/resources/venues")).toBe("Площадки")
    expect(getSectionTitle("/resources/camping")).toBe("Палаточный кемпинг")
  })
})

describe("getQuickCreateItems", () => {
  it("adds only the create action for the active resource section", () => {
    expect(getQuickCreateItems("/resources/houses").contextual.map((item) => item.href)).toEqual(["/resources/houses/new"])
    expect(getQuickCreateItems("/resources/camping/abc").contextual.map((item) => item.href)).toEqual(["/resources/camping/new"])
    expect(getQuickCreateItems("/resources/bath").contextual.map((item) => item.href)).toEqual(["/resources/bath/new"])
    expect(getQuickCreateItems("/resources/venues").contextual.map((item) => item.href)).toEqual(["/resources/venues/new"])
    expect(getQuickCreateItems("/offers/addons").contextual.map((item) => item.href)).toEqual(["/offers/addons?create=1"])
    expect(getQuickCreateItems("/marketing").contextual.map((item) => item.href)).toEqual(["/marketing/promotions/new"])
  })

  it("restores operational creation actions in the programs area", () => {
    expect(getQuickCreateItems("/programs/runs").contextual.map((item) => item.href)).toEqual([
      "/programs/runs/new",
      "/programs/registrations/new",
    ])
  })
})
