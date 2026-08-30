import { expect, test } from "@playwright/test"

test("desktop leads supports shareable table sort and editor navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/leads")

  await expect(page.locator('[data-slot="page-frame"] h1')).toHaveCount(0)
  await expect(page.getByText("Все активные", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { exact: true, name: "Новое" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Карточки" })).toHaveText("")
  const card = page.getByRole("button", { name: "Открыть заявку 1284: Анна Ковалёва" }).locator("..")
  const rail = card.locator('[data-slot="lead-card-rail"]')
  await expect(rail).toBeVisible()
  await expect(rail.getByRole("button", { name: "Действия заявки 1284" })).toBeVisible()
  await expect(rail.getByLabel("Ответственные: Марина Кириллова")).toBeVisible()
  await expect(rail.getByLabel("Просрочен следующий контакт")).toBeVisible()
  await expect(card.getByText("Внимание", { exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: "Таблица" }).click()
  await expect(page).toHaveURL(/view=table/)
  await page.getByRole("button", { name: "Клиент" }).click()
  await expect(page).toHaveURL(/sort=client/)
  await expect(page).toHaveURL(/order=asc/)

  await page.getByRole("button", { name: /Открыть заявку/ }).first().click()
  await expect(page).toHaveURL(/\/leads\/\d+/)
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByLabel("Название заявки")).toBeVisible()
})

test("lead editor keeps shared shell chrome, route tabs and save state operational", async ({ page, isMobile }) => {
  await page.goto("/leads/1284")
  await expect(page.getByRole("heading", { level: 1, name: "Анна Ковалёва" })).toBeVisible()
  await expect(page.getByText("#1284", { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="editor-sidebar"]')).toBeVisible()
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }
  const client = page.getByRole("combobox", { name: "Клиент заявки" })
  await client.click()
  await page.getByRole("option", { name: "Анна Ковалёва" }).click()
  await expect(page.getByText("Есть изменения")).toBeVisible()
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Сохранено")).toBeVisible()
  await page.getByRole("tab", { name: "Маркетинг" }).click()
  await expect(page).toHaveURL(/tab=marketing/)
})

test("desktop lead drag stays above columns and shows the destination slot", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/leads")

  const source = page.getByRole("button", { name: "Открыть заявку 1284: Анна Ковалёва" })
  const destination = page.getByRole("region", { name: /Работа:/ })
  const sourceBox = await source.boundingBox()
  const destinationBox = await destination.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(destinationBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 16)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 12, sourceBox!.y + 28, { steps: 3 })
  await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + destinationBox!.height - 24, { steps: 8 })

  await expect(page.getByTestId("lead-drag-overlay")).toBeVisible()
  await expect(page.getByTestId("lead-drop-placeholder:work")).toBeVisible()
  const overlayZIndex = await page.getByTestId("lead-drag-overlay").evaluate((element) => getComputedStyle(element.parentElement!).zIndex)
  expect(Number(overlayZIndex)).toBeGreaterThan(100)

  await page.mouse.up()
  await expect(page.getByRole("region", { name: /Работа: 3/ })).toBeVisible()
})

test("mobile leads renders compact cards and working filters", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile representation")
  await page.goto("/leads")

  const list = page.getByTestId("mobile-leads-list")
  await expect(list).toBeVisible()
  await expect(page.getByTestId("desktop-leads-view")).toBeHidden()
  await expect(list.getByText(/гост/iu)).toHaveCount(0)
  const unassignedCard = list.getByRole("button", { name: "Открыть заявку 1283: Михаил Белов" }).locator("..")
  const assign = unassignedCard.getByRole("button", { name: "Назначить ответственного заявке 1283" })
  await expect(assign).toBeVisible()
  await assign.click()
  await expect(unassignedCard.getByLabel("Ответственные: Марина Кириллова")).toBeVisible()

  await page.getByRole("combobox", { name: "Область заявок" }).click()
  await page.getByRole("option", { name: "Мои" }).click()
  await expect(page).toHaveURL(/scope=mine/)
  await page.getByRole("button", { name: "Фильтры заявок" }).click()
  const filters = page.getByRole("dialog")
  await expect(filters.getByRole("combobox", { name: "Источник" })).toBeVisible()
  await filters.getByRole("button", { name: "Close" }).click()
  await page.getByRole("tab", { name: "Отказ" }).click()
  await expect(page).toHaveURL(/stage=rejected/)
})
