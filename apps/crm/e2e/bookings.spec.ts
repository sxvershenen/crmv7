import { expect, test } from "@playwright/test"

test("dedicated resource schedule route reuses the operational scheduler", async ({ page, isMobile }) => {
  await page.goto("/schedule")
  await expect(page.getByTestId("vertical-scheduler")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Scheduler" })).toHaveAttribute("aria-selected", "true")
  if (!isMobile) await expect(page.getByRole("link", { name: "Расписание ресурсов" })).toHaveAttribute("aria-current", "page")
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("bookings uses shared navigation, calendar and table without an internal page title/create action", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop table coverage")
  await page.goto("/bookings")
  await expect(page.locator('[data-slot="page-frame"] h1')).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Новая бронь|Быстрая бронь/ })).toHaveCount(0)
  await expect(page.getByRole("tablist", { name: "Категория ресурсов" })).toHaveAttribute("data-variant", "line")
  await expect(page.getByRole("tablist", { name: "Вид бронирований" })).toHaveAttribute("data-variant", "default")
  await expect(page.getByRole("tab", { name: "Scheduler" })).toHaveText("")
  await expect(page.getByText(/занято \d+ \/ \d+/i)).toHaveCount(0)
  await expect(page.locator('[data-slot="agenda-resource-header"]').first()).toHaveClass(/bg-muted\/45/)
  await expect(page.locator('[data-slot="agenda-operation-row"]').first()).not.toHaveClass(/min-h-16/)

  await page.getByRole("button", { name: "Дата бронирований" }).click()
  await expect(page.locator('[data-slot="calendar"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("tab", { name: "Таблица" }).click()
  await expect(page.locator('[data-slot="data-table-shell"]')).toBeVisible()
  await page.getByRole("button", { name: "Клиент" }).click()
  await expect(page).toHaveURL(/sort=client/)
  await expect(page.locator('table [class*="bg-red"], table [class*="text-red"]')).toHaveCount(0)
})

test("vertical scheduler previews Y movement, keeps preparation separate and never scrolls horizontally", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop geometry coverage")
  await page.goto("/bookings?view=scheduler")
  const scheduler = page.getByTestId("vertical-scheduler")
  await expect(scheduler).toHaveAttribute("data-orientation", "vertical")
  await expect(scheduler.locator('[data-day-divider="true"]')).toHaveCount(5)
  await expect(scheduler.getByText(/занято \d+ \/ \d+/i)).toHaveCount(0)
  await expect(scheduler.getByRole("button", { name: /Показать более (ранний|поздний) день/ })).toHaveCount(0)
  await expect.poll(async () => scheduler.locator('[data-scheduler-scroll-viewport="true"]').evaluate((viewport) => {
    const selected = viewport.querySelector('[data-day="2026-08-23"]')
    if (!selected) return false
    return (viewport as HTMLElement).scrollTop > 0 && Math.abs(selected.getBoundingClientRect().top - viewport.getBoundingClientRect().top) < 2
  })).toBe(true)
  await expect(scheduler.locator('[data-slot="preparation-block"]').first()).toBeVisible()
  await expect(scheduler.getByRole("button", { name: /Изменить начало бронирования/ }).first()).toBeVisible()
  await expect(scheduler.getByRole("button", { name: /Изменить окончание бронирования/ }).first()).toBeVisible()

  const selectedDivider = scheduler.locator('[data-day-divider="true"][data-selected="true"]')
  const otherDivider = scheduler.locator('[data-day-divider="true"]:not([data-selected])').first()
  expect(await selectedDivider.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(await otherDivider.evaluate((node) => getComputedStyle(node).backgroundColor))
  await expect(selectedDivider.getByText("выбранный день")).toHaveClass(/bg-info-subtle/)

  const tonePairsMatch = await scheduler.locator('[data-slot="scheduler-booking-block"]').evaluateAll((blocks) => blocks.every((block) => {
    const card = block.querySelector(':scope > button')
    const badge = block.querySelector('[data-slot="badge"]')
    return !card || !badge || getComputedStyle(card).backgroundColor === getComputedStyle(badge).backgroundColor
  }))
  expect(tonePairsMatch).toBe(true)
  const bookingAction = scheduler.getByRole("button", { name: "Изменить бронь #2048", exact: true })
  await expect(bookingAction).toHaveClass(/bg-transparent/)
  await expect(bookingAction).toHaveClass(/shadow-none/)
  await expect(scheduler.getByRole("button", { name: "Изменить начало бронирования #2048" }).locator("span")).toHaveClass(/bg-current\/70/)

  const resourceSelect = page.getByRole("combobox", { name: "Ресурс scheduler" })
  await expect(resourceSelect).toHaveClass(/bg-background/)
  await expect(scheduler.getByRole("combobox", { name: "Ресурс scheduler" })).toHaveCount(0)
  await resourceSelect.click()
  const resourcePopover = page.locator('[data-slot="select-content"]')
  await expect(resourcePopover).toBeVisible()
  expect(await resourcePopover.evaluate((node) => node.getBoundingClientRect().right <= window.innerWidth)).toBe(true)
  await page.keyboard.press("Escape")

  for (const width of [1024, 1280, 1680]) {
    await page.setViewportSize({ height: 900, width })
    const sizes = await scheduler.evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }))
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
  }

  const card = scheduler.getByRole("button", { name: /Переместить бронирование/ }).first()
  const cardContainer = card.locator("..")
  await card.scrollIntoViewIfNeeded()
  const originalTop = await cardContainer.evaluate((node) => (node as HTMLElement).style.top)
  const box = await card.boundingBox()
  if (!box) throw new Error("Scheduler booking is not visible")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 62, { steps: 6 })
  await expect(cardContainer).not.toHaveCSS("top", originalTop)
  await expect(scheduler.getByLabel(/Исходный интервал бронирования/).first()).toBeVisible()
  await expect(scheduler.locator('[data-preparation-preview="true"]').first()).toBeVisible()
  await page.mouse.up()

})

test("scheduler create slot opens a preset booking editor", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop scheduler create-slot coverage")
  await page.goto("/bookings?view=scheduler")

  const scheduler = page.getByTestId("vertical-scheduler")
  await expect.poll(async () => scheduler.locator('[data-scheduler-scroll-viewport="true"]').evaluate((viewport) => {
    const selected = viewport.querySelector('[data-day-divider="true"][data-selected="true"]')
    if (!selected) return false
    return Math.abs(selected.getBoundingClientRect().top - viewport.getBoundingClientRect().top) < 2
  })).toBe(true)
  await scheduler.locator('[data-day-divider="true"][data-selected="true"]').locator("..").getByRole("link", { name: /Создать бронь:/ }).first().click()
  await expect(page).toHaveURL(/\/bookings\/new\?.*resource=.*start=/)
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Клиент бронирования" })).toContainText("Новый клиент")
})

test("booking editor follows the shared desktop and mobile editor contract", async ({ page, isMobile }) => {
  await page.goto("/bookings/2048")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Клиент бронирования" })).toContainText("Анна Смирнова")
  await expect(page.locator('[data-slot="editor-sidebar"]')).toBeVisible()
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Оплата", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Сохранить" })).toBeVisible()

  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
    const client = await page.getByRole("combobox", { name: "Клиент бронирования" }).boundingBox()
    expect(client?.height).toBeGreaterThan(0)
  }

  await page.getByRole("tab", { name: "Состав" }).click()
  await expect(page).toHaveURL(/tab=composition/)
  await page.getByRole("button", { name: "Дублировать позицию 1" }).click()
  await expect(page.getByText("Позиция 2")).toBeVisible()
})

test("mobile keeps view=scheduler and renders exactly one selected resource lane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile scheduler coverage")
  await page.goto("/bookings?view=scheduler")
  await expect(page).toHaveURL(/view=scheduler/)
  await expect(page.getByTestId("vertical-scheduler")).toBeVisible()
  await expect(page.getByRole("region", { name: /Agenda/ })).toHaveCount(0)
  await expect(page.locator('[data-resource-lane]')).toHaveCount(5)
  const visibleResourceIds = await page.locator('[data-resource-lane]').evaluateAll((nodes) => [...new Set(nodes.filter((node) => getComputedStyle(node).display !== "none").map((node) => node.getAttribute("data-resource-lane")))])
  expect(visibleResourceIds).toHaveLength(1)
  const categoryTabs = page.getByRole("tablist", { name: "Категория ресурсов" })
  const resourceSelect = page.getByRole("combobox", { name: "Ресурс scheduler" })
  const [categoryBox, resourceBox] = await Promise.all([categoryTabs.boundingBox(), resourceSelect.boundingBox()])
  expect(categoryBox && resourceBox && categoryBox.y < resourceBox.y + resourceBox.height && resourceBox.y < categoryBox.y + categoryBox.height).toBe(true)
  await expect(page.getByTestId("vertical-scheduler").getByRole("combobox", { name: "Ресурс scheduler" })).toHaveCount(0)
  await resourceSelect.click()
  await page.getByRole("option", { name: "Дом у озера с очень длинным названием" }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole("tab", { name: "Дома" }).click()
  await expect(page).toHaveURL(/category=houses/)
  await page.getByRole("button", { name: "Следующий день" }).click()
  await expect(page).toHaveURL(/date=2026-08-24/)
})

test("scheduler keyboard/touch action exposes exact edit and rolls a rejected fixture change back", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop fixture card is on the first lane page")
  await page.goto("/bookings?view=scheduler")
  await page.getByRole("button", { name: "Изменить бронь #2051", exact: true }).click()
  await page.getByRole("menuitem", { name: "Время и ресурс" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Начало" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Окончание" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Ресурс" })).toBeVisible()
  await page.getByRole("button", { name: "Отмена" }).click()

  await page.getByRole("button", { name: "Изменить бронь #2051", exact: true }).click()
  await page.getByRole("menuitem", { name: "Позже" }).click()
  await expect(page.getByRole("alert")).toContainText("прежний интервал восстановлен")
})
