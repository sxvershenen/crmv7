import { expect, test } from "@playwright/test"

test("desktop programs switch template, run and date-centric scheduler views", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/programs")
  await expect(page.getByTestId("desktop-program-templates")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Шаблоны" })).toHaveAttribute("aria-selected", "true")

  await page.getByRole("tab", { name: "Проведения" }).click()
  await expect(page).toHaveURL(/section=runs/)
  await expect(page.getByTestId("desktop-program-runs")).toBeVisible()
  await page.getByRole("tab", { name: "Scheduler" }).click()
  await expect(page.getByTestId("program-scheduler")).toBeVisible()
  await expect(page.getByRole("region", { name: "Календарь проведений" }).locator("article:visible")).toHaveCount(3)
  await expect(page).toHaveURL(/view=scheduler/)
})

test("desktop fast status and category management remain operational", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/programs?section=runs")
  const runTable = page.getByTestId("desktop-program-runs")
  const assign = runTable.getByRole("button", { name: "Назначить ответственного проведению Семейный день в лесу — вечерняя группа" })
  const combinedCell = assign.locator("xpath=ancestor::td[1]")
  await expect(combinedCell.getByRole("combobox", { name: "Статус проведения #25082" })).toBeVisible()
  await assign.click()
  await expect(assign).toHaveCount(0)
  await expect(page.getByText("Марина Кириллова назначена проведению #25082")).toBeAttached()

  const status = page.getByRole("combobox", { name: "Статус проведения #24081" }).first()
  await status.click()
  await page.getByRole("option", { name: "Завершено" }).click()
  await expect(status).toContainText("Завершено")

  await page.getByRole("button", { name: "Управление категориями программ" }).click()
  await expect(page).toHaveURL(/\/programs\/categories$/)
  await expect(page.getByRole("region", { name: "Категории программ" })).toBeVisible()
  await page.getByRole("button", { name: "Новая категория" }).click()
  await expect(page).toHaveURL(/\/programs\/categories\/new$/)
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Новая категория")
})

test("mobile programs use compact cards and a one-day scheduler without overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile representation")
  await page.goto("/programs")
  await expect(page.getByTestId("mobile-program-templates")).toBeVisible()
  await expect(page.getByTestId("desktop-program-templates")).toBeHidden()
  await page.getByRole("tab", { name: "Проведения" }).click()
  await expect(page.getByTestId("mobile-program-runs")).toBeVisible()
  const mobileAssign = page.getByTestId("mobile-program-runs").getByRole("button", { name: "Назначить ответственного проведению Семейный день в лесу — вечерняя группа" })
  const mobileStatusRow = mobileAssign.locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")
  await expect(mobileStatusRow.getByRole("combobox", { name: "Статус проведения #25082" })).toBeVisible()
  await page.getByRole("tab", { name: "Scheduler" }).click()
  await expect(page.getByTestId("program-scheduler").locator("article:visible")).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("program template editor follows shared chrome and keeps stage actions operational", async ({ page, isMobile }) => {
  await page.goto("/programs/forest-family")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Семейный день в лесу")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }

  await page.getByRole("tab", { name: "Сценарий" }).click()
  await page.getByLabel("Название этапа", { exact: true }).first().fill("Знакомство")
  await page.getByLabel(/Минут/).first().fill("15")
  await page.getByRole("button", { name: "Добавить этап" }).click()
  await page.getByRole("button", { name: "Дублировать этап 1" }).click()
  await page.getByRole("button", { name: "Поднять этап 2" }).click()
  await expect(page.getByRole("button", { name: /Поднять этап/ })).toHaveCount(5)
})

test("desktop program stages support drag reordering", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop pointer DnD coverage")
  await page.goto("/programs/forest-family?tab=content")

  for (const name of ["Первый этап", "Второй этап"]) {
    await page.getByLabel("Название этапа", { exact: true }).fill(name)
    await page.getByLabel(/Минут/).last().fill("10")
    await page.getByRole("button", { name: "Добавить этап" }).click()
  }
  const source = page.getByRole("button", { name: "Перетащить этап 2" })
  const target = page.getByRole("button", { name: "Перетащить этап 1" })
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 8, sourceBox!.y - 12, { steps: 3 })
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('input[value="Второй этап"]')).toHaveCount(1)
})

test("program run editor keeps registrations, resources and shared chrome operational", async ({ page, isMobile }) => {
  await page.goto("/programs/runs/24081")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название проведения" })).toHaveValue("Семейный день в лесу")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }

  await page.getByRole("tab", { name: "Регистрации" }).click()
  if (isMobile) await page.getByRole("button", { name: "Заполнить регистрацию" }).click()
  await page.getByRole("combobox", { name: "Клиент регистрации" }).click()
  await page.getByText("Анна Ковалёва", { exact: true }).last().click()
  await page.getByLabel("Участников", { exact: true }).fill("2")
  await page.getByLabel("Стоимость").fill("8000")
  await page.getByLabel("Оплачено", { exact: true }).fill("4000")
  await page.getByRole("button", { name: "Добавить регистрацию" }).click()
  await expect(page.getByText("Анна Ковалёва").first()).toBeVisible()
  await expect(page.getByText("19 из 24")).toBeVisible()

  await page.getByRole("tab", { name: "Ресурсы" }).click()
  await page.getByRole("button", { name: "Добавить бронь" }).click()
  await expect(page.getByRole("article").filter({ hasText: /Дом «Сосна».*24 гостей/ })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("program registration editor keeps payments, comments and shared chrome operational", async ({ page, isMobile }) => {
  await page.goto("/programs/registrations/5011")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Клиент регистрации" })).toContainText("Михаил Белов")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }

  await page.getByRole("tab", { name: "Коммуникации" }).click()
  await page.getByLabel("Содержание коммуникации").fill("Уточнить питание")
  await page.getByRole("button", { name: "Отправить" }).click()
  await expect(page.getByText("Уточнить питание")).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
