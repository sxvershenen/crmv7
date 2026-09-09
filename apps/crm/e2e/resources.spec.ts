import { expect, test } from "@playwright/test"

test("desktop resources keep category, filters and card navigation operational", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop representation")
  await page.goto("/resources/houses")

  await expect(page.locator('[data-slot="page-frame"] h1')).toHaveCount(0)
  await expect(page.getByRole("tab", { name: "Домики" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("region", { name: "Список ресурсов" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Установить блокировку" }).first()).toBeEnabled()
  await expect(page.getByRole("button", { name: /создать ресурс/iu })).toHaveCount(0)

  const blockSelect = page.locator('[data-slot="settings-bar"] [role="combobox"]:visible').first()
  await blockSelect.click()
  await page.getByRole("option", { name: "Есть блокировка" }).click()
  await expect(page).toHaveURL(/block=active/)
  await page.getByRole("button", { name: /Открыть ресурс: Дом у озера/ }).click()
  await expect(page).toHaveURL(/\/resources\/houses\/house-lake$/)
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Дом у озера с очень длинным названием")
})

test("resource editor keeps shared chrome, block flow and responsive actions operational", async ({ page, isMobile }) => {
  await page.goto("/resources/houses/house-pine")
  await expect(page.locator('[data-slot="editor-frame"]')).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Название", exact: true })).toHaveValue("Дом «Сосна»")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-mobile-actions"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.locator('[data-slot="editor-desktop-actions"]')).toBeVisible()
  }

  await page.getByRole("tab", { name: "Блокировки" }).click()
  await expect(page).toHaveURL(/tab=blocks/)
  await page.getByRole("button", { name: "Период блокировки" }).click()
  await page.getByRole("button", { name: /^вторник, 1 сентября 2026 г\.$/ }).click()
  await page.getByRole("button", { name: /^среда, 2 сентября 2026 г\.$/ }).click()
  await page.getByLabel("Период блокировки: время начала").fill("10:00")
  await page.getByLabel("Период блокировки: время окончания").fill("14:00")
  await page.getByRole("button", { name: "Готово" }).click()
  await page.getByLabel("Причина").fill("Техническое окно")
  await page.getByRole("button", { name: "Добавить блокировку" }).click()
  await expect(page.getByText("Техническое окно")).toBeVisible()
})

test("mobile resources use one card column and accessible shared capacity", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile representation")
  await page.goto("/resources/camping")

  const list = page.getByRole("region", { name: "Список ресурсов" })
  await expect(list).toBeVisible()
  await expect(page.getByRole("progressbar", { name: "Занято 9 из 16" })).toBeVisible()
  await expect(page.getByText(/гост/iu)).toHaveCount(0)
  await expect.poll(() => list.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole("tab", { name: "Баня и чан" }).click()
  await expect(page).toHaveURL(/\/resources\/bath$/)
  await expect(page.getByText("Баня у озера", { exact: true })).toBeVisible()
})

test("invalid resource category redirects canonically", async ({ page }) => {
  await page.goto("/resources/unknown?warning=with")
  await expect(page).toHaveURL(/\/resources\/houses\?warning=with$/)
})
