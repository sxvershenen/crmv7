import { expect, test } from "@playwright/test"

test("accepts a manual invitation without exposing the token to the server URL", async ({ page }) => {
  const token = "a".repeat(43)
  let posted: unknown
  await page.route("**/api/internal/v1/auth/invitations/accept", async (route) => {
    posted = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: "manager@example.invalid" }) })
  })
  await page.goto(`/invite#${token}`)
  await expect(page.getByRole("heading", { name: "Приглашение в CRM" })).toBeVisible()
  await page.getByLabel("Новый пароль").fill("very-strong-password")
  await page.getByLabel("Повторите пароль").fill("very-strong-password")
  await page.getByRole("button", { name: "Создать доступ" }).click()
  await expect(page.getByText("Доступ для manager@example.invalid активирован.")).toBeVisible()
  expect(posted).toEqual({ token, password: "very-strong-password" })
  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole("link", { name: "Войти в CRM" })).toHaveAttribute("href", "/")
})
