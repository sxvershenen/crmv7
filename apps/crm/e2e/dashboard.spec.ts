import { expect, test } from "@playwright/test"

test("dashboard filters and row navigation are truthful", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { exact: true, name: "Сегодня" })).toBeVisible()
  await expect(page.getByRole("heading", { exact: true, name: "Внимание" })).toBeVisible()
  await expect(page.getByText(/бронировали/iu)).toHaveCount(0)
  await expect(page.getByText("Хотят:", { exact: true })).toHaveCount(0)
  await expect(page.getByLabel("5 человек")).toBeVisible()
  await expect(page.getByRole("progressbar", { name: /оплачено.*12.*из.*28/iu })).toBeVisible()
  await expect(page.getByText(/гост/iu)).toHaveCount(0)

  await page.getByRole("combobox", { name: "Область обзора" }).click()
  await page.getByRole("option", { name: "Мои" }).click()
  await expect(page).toHaveURL(/scope=mine/)

  await page.getByRole("link", { name: /#1044/ }).click()
  await expect(page).toHaveURL(/bookings\/1044/)
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByText("Бронирование не найдено", { exact: true })).toBeVisible()
})

test("component gallery exposes required state groups", async ({ page }) => {
  await page.goto("/dev/ui")

  await expect(page.locator("#main-content").getByRole("heading", { exact: true, name: "UI и компоненты" })).toBeVisible()
  await expect(page.getByText("Conflict", { exact: true })).toBeVisible()
  await expect(page.getByText("Scheduler blocks", { exact: true })).toBeVisible()
})
