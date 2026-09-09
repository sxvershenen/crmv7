import { expect, test, type Page } from "@playwright/test"

async function login(page: Page) {
  await page.goto("/programs/PROGRAM-FAMILY?tab=commercial")
  await expect(page.getByRole("heading", { name: "Вход в CRM" })).toBeVisible()
  await page.getByLabel("Пароль").fill("change-me-in-local-env")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page.getByRole("tab", { name: "Продажи и цены" })).toHaveAttribute("aria-selected", "true")
}

test("program offering survives API reload and remains public fail-closed", async ({ page }) => {
  await login(page)

  const prepare = page.getByRole("button", { name: "Подготовить продажи и CMS-страницу" })
  const cmsDraft = page.getByText("CMS-черновик", { exact: true })
  await expect(prepare.or(cmsDraft).first()).toBeVisible()
  if (await prepare.isVisible()) {
    const response = page.waitForResponse((item) => item.request().method() === "POST" && /\/programs\/[0-9a-f-]+\/offering$/i.test(new URL(item.url()).pathname))
    await prepare.click()
    expect((await response).status()).toBe(201)
  }

  await expect(cmsDraft).toBeVisible()
  await expect(page.getByText("Закрыт до public gate")).toBeVisible()

  const createDraft = page.getByRole("button", { name: "Создать черновик тарифа" })
  const activate = page.getByRole("button", { name: "Активировать тариф" })
  const active = page.getByText("Тариф активен")
  await expect(createDraft.or(activate).or(active).first()).toBeVisible()
  if (await createDraft.isVisible()) {
    const response = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname.endsWith("/price-books/drafts"))
    await createDraft.click()
    expect((await response).status()).toBe(201)
    await expect(activate).toBeVisible()
  }

  if (await activate.isVisible()) {
    const response = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname.endsWith("/activate"))
    await activate.click()
    expect((await response).status()).toBe(200)
  }
  await expect(active).toBeVisible()

  const quoteResponse = page.waitForResponse((item) => item.request().method() === "POST" && new URL(item.url()).pathname.endsWith("/offering/quotes/preview"))
  const calculate = page.getByRole("button", { name: "Рассчитать" })
  await expect(calculate).toBeEnabled()
  await calculate.click()
  expect((await quoteResponse).status()).toBe(200)
  await expect(page.getByText("Не для подтверждения")).toBeVisible()

  await page.reload()
  await expect(page.getByText("Тариф активен")).toBeVisible()
  await expect(page.getByText("Закрыт до public gate")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
