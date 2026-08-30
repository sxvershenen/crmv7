import { expect, test } from "@playwright/test"

test("finance summary, category filtering and registry stay operational", async ({ page, isMobile }) => {
  await page.goto("/finance")
  await expect(page.getByTestId("finance-content")).toBeVisible()
  await expect(page.getByTestId("finance-chart")).toBeVisible()
  await page.getByRole("tab", { name: "Мероприятия" }).click()
  await expect(page).toHaveURL(/section=events/)
  await expect(page.getByTestId(isMobile ? "mobile-finance-operations" : "finance-table")).toBeVisible()
})

test("finance dynamics and registry pagination preserve URL state", async ({ page }) => {
  await page.goto("/finance?period=week&sort=amount&order=asc")
  await page.getByTestId("finance-pagination").getByRole("button", { name: "2" }).click()
  await expect(page).toHaveURL(/period=week&sort=amount&order=asc&page=2/)
  await page.getByRole("tab", { name: "Динамика" }).click()
  await expect(page.getByTestId("finance-dynamics")).toBeVisible()
  await expect(page.getByTestId("finance-dynamics").locator('[data-slot="chart"]')).toHaveCount(4)
})

test("mobile finance has no horizontal overflow", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only check")
  await page.goto("/finance")
  await expect(page.getByTestId("mobile-finance-operations")).toBeVisible()
  await expect(page.getByText("Листайте показатели")).toBeVisible()
  await page.getByRole("button", { name: "Фильтры финансов" }).click()
  await expect(page.getByRole("heading", { name: "Фильтры финансов" })).toBeVisible()
  const viewport = page.viewportSize()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(viewport?.width ?? width)
})
