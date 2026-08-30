import { describe, expect, it } from "vitest"

import { getSectionTitle } from "./navigation"

describe("getSectionTitle", () => {
  it("does not let the root route shadow operational breadcrumbs", () => {
    expect(getSectionTitle("/")).toBe("Обзор")
    expect(getSectionTitle("/leads")).toBe("Заявки")
    expect(getSectionTitle("/bookings/1048")).toBe("Бронирования")
    expect(getSectionTitle("/profile")).toBe("Профиль")
    expect(getSectionTitle("/team")).toBe("Команда")
    expect(getSectionTitle("/settings")).toBe("Настройки CRM")
    expect(getSectionTitle("/customers")).toBe("Клиенты")
    expect(getSectionTitle("/resources/houses/house-pine")).toBe("Домики")
    expect(getSectionTitle("/resources/bath")).toBe("Баня и чан")
    expect(getSectionTitle("/resources/venues")).toBe("Площадки")
    expect(getSectionTitle("/resources/camping")).toBe("Палаточный кемпинг")
  })
})
