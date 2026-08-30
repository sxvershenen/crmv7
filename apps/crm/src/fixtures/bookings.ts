import type { Booking, BookingOperation, BookingResource } from "@app/entities/bookings"

export const bookingResourcesFixture: BookingResource[] = [
  { id: "house-pine", name: "Дом «Сосна»", category: "houses", capacity: 6, occupied: 4 },
  { id: "house-lake", name: "Дом у озера с очень длинным названием", category: "houses", capacity: 8, occupied: 5 },
  { id: "camp-north", name: "Кемпинг Север", category: "camping", capacity: 16, occupied: 9 },
  { id: "tent-meadow", name: "Палаточное место «Луг»", category: "tents", capacity: 10, occupied: 3 },
  { id: "house-birch", name: "Дом «Берёза»", category: "houses", capacity: 4, occupied: 2 },
  { id: "tent-river", name: "Палаточное место у реки", category: "tents", capacity: 12, occupied: 7 },
  { id: "bath-main", name: "Баня и чан", category: "bath", capacity: 8, occupied: 4 },
  { id: "venue-meadow", name: "Площадка «Большой луг»", category: "venues", capacity: 120, occupied: 46 },
]

export const bookingsFixture: Booking[] = [
  {
    id: "2034", clientName: "Елена Тихонова", phone: "+7 926 870-14-22", resourceId: "house-birch", resourceName: "Дом «Берёза»", category: "houses",
    date: "2026-08-22", startHour: 12, endHour: 16, preparationEndHour: 17, guestCount: 2, status: "paid", amount: 21000, paid: 21000,
    source: "Телефон", utm: "direct", promo: "Без промокода", sourceLeadId: null, assignees: [],
  },
  {
    id: "2048", clientName: "Анна Смирнова", phone: "+7 921 555-14-08", resourceId: "house-pine", resourceName: "Дом «Сосна»", category: "houses",
    date: "2026-08-23", startHour: 9, endHour: 13, preparationEndHour: 14, guestCount: 4, status: "confirmed", amount: 28000, paid: 14000,
    source: "Сайт", utm: "organic", promo: "Семья", sourceLeadId: "1284", assignees: [{ id: "mk", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }],
  },
  {
    id: "2051", clientName: "Илья Воронцов", phone: "+7 999 440-80-31", resourceId: "house-lake", resourceName: "Дом у озера с очень длинным названием", category: "houses",
    date: "2026-08-23", startHour: 11, endHour: 17, preparationEndHour: 18, guestCount: 6, status: "paid", amount: 42000, paid: 42000,
    source: "Телефон", utm: "direct", promo: "Без промокода", sourceLeadId: null, assignees: [{ id: "av", initials: "АВ", name: "Алексей Власов", colorClass: "bg-emerald-100 text-emerald-700" }], demoRejectMove: true,
  },
  {
    id: "2055", clientName: "Семья Мельниковых", phone: "+7 911 203-77-20", resourceId: "camp-north", resourceName: "Кемпинг Север", category: "camping",
    date: "2026-08-23", startHour: 14, endHour: 19, preparationEndHour: 20, guestCount: 5, status: "debt", amount: 18500, paid: 5000,
    source: "Telegram", utm: "telegram", promo: "Лето", sourceLeadId: null, assignees: [],
  },
  {
    id: "2057", clientName: "Пётр Орлов", phone: "+7 903 111-42-01", resourceId: "tent-meadow", resourceName: "Палаточное место «Луг»", category: "tents",
    date: "2026-08-23", startHour: 16, endHour: 20, preparationEndHour: 21, guestCount: 2, status: "conflict", amount: 8000, paid: 0,
    source: "Сайт", utm: "yandex_cpc", promo: "Без промокода", sourceLeadId: null, assignees: [],
  },
  {
    id: "2039", clientName: "Ольга Нестерова", phone: "+7 916 430-03-02", resourceId: "house-pine", resourceName: "Дом «Сосна»", category: "houses",
    date: "2026-08-23", startHour: 18, endHour: 21, preparationEndHour: 22, guestCount: 3, status: "cancelled", amount: 16000, paid: 0,
    source: "VK", utm: "vk_cpc", promo: "Без промокода", sourceLeadId: null, assignees: [],
  },
  {
    id: "2062", clientName: "Никита Беляев", phone: "+7 905 740-61-91", resourceId: "house-pine", resourceName: "Дом «Сосна»", category: "houses",
    date: "2026-08-24", startHour: 10, endHour: 15, preparationEndHour: 16, guestCount: 2, status: "draft", amount: 24000, paid: 0,
    source: "Сайт", utm: "organic", promo: "Лето", sourceLeadId: null, assignees: [],
  },
  {
    id: "2064", clientName: "Сергей Лебедев", phone: "+7 921 107-77-63", resourceId: "bath-main", resourceName: "Баня и чан", category: "bath",
    date: "2026-08-24", startHour: 16, endHour: 19, preparationEndHour: 20, guestCount: 6, status: "confirmed", amount: 18500, paid: 8000,
    source: "VK", utm: "vk_cpc", promo: "Без промокода", sourceLeadId: "1279", assignees: [],
  },
  {
    id: "2065", clientName: "ООО «Северные истории»", phone: "+7 812 440-18-20", resourceId: "venue-meadow", resourceName: "Площадка «Большой луг»", category: "venues",
    date: "2026-08-24", startHour: 12, endHour: 21, preparationEndHour: 22, guestCount: 46, status: "debt", amount: 142000, paid: 48000,
    source: "Email", utm: "repeat", promo: "Корпоратив", sourceLeadId: null, assignees: [],
  },
]

const operation = (bookingId: string, resourceId: string, kind: BookingOperation["kind"], hour: number, clientName: string, status: BookingOperation["status"], date = "2026-08-23"): BookingOperation => ({
  id: `${bookingId}-${kind}`, bookingId, resourceId, kind, time: `${date}T${String(hour).padStart(2, "0")}:00:00+03:00`, timeLabel: `${String(hour).padStart(2, "0")}:00`, clientName, status,
})

export const bookingOperationsFixture: BookingOperation[] = [
  operation("2034", "house-birch", "arrival", 12, "Елена Тихонова", "paid", "2026-08-22"),
  operation("2034", "house-birch", "departure", 16, "Елена Тихонова", "paid", "2026-08-22"),
  operation("2048", "house-pine", "arrival", 9, "Анна Смирнова", "confirmed"),
  operation("2048", "house-pine", "departure", 13, "Анна Смирнова", "confirmed"),
  operation("2048", "house-pine", "preparation", 13, "Анна Смирнова", "confirmed"),
  operation("2051", "house-lake", "arrival", 11, "Илья Воронцов", "paid"),
  operation("2051", "house-lake", "departure", 17, "Илья Воронцов", "paid"),
  operation("2051", "house-lake", "preparation", 17, "Илья Воронцов", "paid"),
  operation("2055", "camp-north", "arrival", 14, "Семья Мельниковых", "debt"),
  operation("2055", "camp-north", "block", 18, "Семья Мельниковых", "debt"),
  operation("2057", "tent-meadow", "arrival", 16, "Пётр Орлов", "conflict"),
  operation("2039", "house-pine", "arrival", 18, "Ольга Нестерова", "cancelled"),
  operation("2062", "house-pine", "arrival", 10, "Никита Беляев", "draft", "2026-08-24"),
  operation("2062", "house-pine", "departure", 15, "Никита Беляев", "draft", "2026-08-24"),
  operation("2064", "bath-main", "arrival", 16, "Сергей Лебедев", "confirmed", "2026-08-24"),
  operation("2064", "bath-main", "departure", 19, "Сергей Лебедев", "confirmed", "2026-08-24"),
  operation("2065", "venue-meadow", "arrival", 12, "ООО «Северные истории»", "debt", "2026-08-24"),
  operation("2065", "venue-meadow", "departure", 21, "ООО «Северные истории»", "debt", "2026-08-24"),
]
