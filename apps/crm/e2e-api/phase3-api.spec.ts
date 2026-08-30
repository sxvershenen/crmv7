import { expect, test } from "@playwright/test"

test("authenticated customer edit survives a full reload", async ({ page }) => {
  await page.goto("/customers")
  await expect(page.getByRole("heading", { name: "Вход в CRM" })).toBeVisible()
  await page.getByLabel("Пароль").fill("change-me-in-local-env")
  await page.getByRole("button", { name: "Войти" }).click()

  const table = page.getByTestId("desktop-customers-table")
  await expect(table).toBeVisible()
  await table.getByRole("row", { name: "Открыть клиента Илья Воронцов" }).press("Enter")

  const name = page.getByLabel("Имя или название")
  await expect(name).toHaveValue("Илья Воронцов")
  await name.fill("Илья Воронцов · проверка reload")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Сохранено")).toBeVisible()

  await page.reload()
  await expect(page.getByLabel("Имя или название")).toHaveValue("Илья Воронцов · проверка reload")

  await page.getByLabel("Имя или название").fill("Илья Воронцов")
  await page.getByRole("button", { name: "Сохранить" }).click()
  await expect(page.getByText("Сохранено")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Имя или название")).toHaveValue("Илья Воронцов")
})
