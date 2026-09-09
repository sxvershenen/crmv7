import { expect, test } from "@playwright/test"

test("desktop events table, scheduler, assignment and categories stay operational", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/events")
  await expect(page.getByTestId("desktop-events")).toBeVisible()
  const table = page.getByTestId("desktop-events")
  await expect(table.getByText(/Выездное мероприятие/).first()).toBeVisible()
  const row = table.getByRole("combobox", { name: "Статус мероприятия #E-3114" }).locator("xpath=ancestor::tr")
  await row.getByRole("button", { name: /Назначить ответственного мероприятию Выездной тимбилдинг/ }).click()
  await expect(row.getByLabel("Ответственные: Марина Кириллова")).toBeVisible()
  await page.getByRole("tab", { name: "Scheduler" }).click()
  await expect(page.getByTestId("event-scheduler")).toBeVisible()
  await expect(page.getByRole("region", { name: "Календарь мероприятий" }).locator("article:visible")).toHaveCount(3)
  await page.getByRole("button", { name: "Управление категориями мероприятий" }).click()
  await expect(page).toHaveURL(/\/events\/categories$/)
})

test("mobile events cards and one-day scheduler have no horizontal overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile representation")
  await page.goto("/events")
  await expect(page.getByTestId("mobile-events")).toBeVisible()
  await expect(page.getByTestId("desktop-events")).toBeHidden()
  await page.getByRole("tab", { name: "Scheduler" }).click()
  await expect(page.getByTestId("event-scheduler").locator("article:visible")).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("event editor keeps resources, scenario and shared chrome operational", async ({ page, isMobile }) => {
  await page.goto("/events/E-3108")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Свадьба Анны и Михаила")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }

  await page.getByRole("tab", { name: "Ресурсы" }).click()
  await page.getByRole("button", { name: "Добавить бронь" }).click()
  await expect(page.getByRole("button", { name: /Дом «Сосна».*24 авг/ })).toBeVisible()
  await page.getByRole("tab", { name: "Сценарий" }).click()
  for (const name of ["Встреча гостей", "Ужин"]) {
    await page.getByLabel("Название этапа", { exact: true }).first().fill(name)
    await page.getByRole("button", { name: "Добавить этап" }).click()
  }
  await page.getByRole("button", { name: "Поднять этап 2" }).click()
  await expect(page.getByRole("button", { name: /Поднять этап/ })).toHaveCount(5)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("desktop event scenario supports drag reordering", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop pointer DnD coverage")
  await page.goto("/events/E-3108?tab=scenario")
  for (const name of ["Первый этап", "Второй этап"]) {
    await page.getByLabel("Название этапа", { exact: true }).first().fill(name)
    await page.getByRole("button", { name: "Добавить этап" }).click()
  }
  const source = page.getByRole("button", { name: "Перетащить этап 2" })
  const target = page.getByRole("button", { name: "Перетащить этап 1" })
  const sourceBox = await source.boundingBox(); const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull(); expect(targetBox).not.toBeNull()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 8, sourceBox!.y - 12, { steps: 3 })
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('input[value="Второй этап"]')).toHaveCount(1)
})

test("program categories and the event category dossier keep responsive route-driven chrome", async ({ page, isMobile }) => {
  await page.goto("/programs/categories/family")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Семейные")
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  await page.getByRole("tab", { name: "Шаблоны" }).click()
  await expect(page.getByRole("button", { name: /Семейный день в лесу/ })).toBeVisible()
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  }

  await page.goto("/events/categories")
  await expect(page.getByRole("heading", { name: "Категории мероприятий" })).toBeVisible()
  await page.getByRole("button", { name: "Открыть Категория мероприятия" }).click()
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Формат" })).toContainText("Свадьба")
  await expect(page.getByText("Public закрыт")).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
