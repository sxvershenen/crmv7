import { expect, test } from "@playwright/test"

test("desktop customers supports URL-backed sort, filters and row navigation", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/customers")

  const table = page.getByTestId("desktop-customers-table")
  await expect(table).toBeVisible()
  await page.getByRole("button", { name: "Долг" }).click()
  await expect(page).toHaveURL(/sort=debt/)
  await page.getByRole("button", { name: "Признаки клиентов" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Есть долг" }).click()
  await expect(page).toHaveURL(/flags=debt/)

  const assignButtons = table.getByRole("button", { name: "+ Назначить" })
  await expect(assignButtons.first()).toBeVisible()
  const assignCount = await assignButtons.count()
  await assignButtons.first().click()
  await expect(assignButtons).toHaveCount(assignCount - 1)

  await table.getByRole("row", { name: /Открыть клиента/ }).first().press("Enter")
  await expect(page).toHaveURL(/\/customers\/\d+/)
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
})

test("mobile customers uses compact cards with working phone and actions", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile representation")
  await page.goto("/customers")

  const list = page.getByTestId("mobile-customers-list")
  await expect(list).toBeVisible()
  await expect(page.getByTestId("desktop-customers-table")).toBeHidden()
  await expect(list.getByRole("button", { name: /Позвонить/ }).first()).toBeVisible()
  await expect(list.getByText("Оборот")).toHaveCount(0)

  await page.getByRole("button", { name: "Фильтры клиентов" }).click()
  await page.getByRole("combobox", { name: "Канал" }).click()
  await page.getByRole("option", { name: "Telegram" }).click()
  await expect(page).toHaveURL(/channel=Telegram/)
  await list.getByRole("button", { name: /Открыть клиента/ }).first().click()
  await expect(page).toHaveURL(/\/customers\/\d+/)
})

test("customer editor reuses shared shell chrome and form sizing", async ({ page, isMobile }) => {
  await page.goto("/customers/1042")
  await expect(page.getByRole("heading", { level: 1, name: "Анна Ковалёва" })).toBeVisible()
  await expect(page.getByText("#1042", { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Состояние", { exact: true })).toHaveCount(0)
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }
  const name = page.getByLabel("Имя или название")
  const type = page.getByRole("combobox", { name: "Тип клиента" })
  expect((await name.boundingBox())?.height).toBe((await type.boundingBox())?.height)
  await name.fill("Анна Ковалёва — обновлено")
  await expect(page.getByText("Есть изменения")).toBeVisible()
  await page.getByRole("tab", { name: "Оплаты" }).click()
  await expect(page).toHaveURL(/tab=payments/)
})
