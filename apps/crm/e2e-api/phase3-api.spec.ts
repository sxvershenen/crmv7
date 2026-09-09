import { expect, test, type Page } from "@playwright/test"

const seededBookingPath = "/bookings/BOOKING-LOCAL-001"

async function login(page: Page, path = seededBookingPath) {
  await page.goto(path)
  await expect(page.getByRole("heading", { name: "Вход в CRM" })).toBeVisible()
  await page.getByLabel("Пароль").fill("change-me-in-local-env")
  await page.getByRole("button", { name: "Войти" }).click()
  await expect(page.getByRole("button", { name: "Найти и связать заявку" })).toBeVisible()
}

function relationResponse(page: Page, suffix: "/lead-link" | "/lead-link/unlink") {
  return page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith(suffix))
}

async function showRelationPicker(page: Page) {
  await expect(page.getByRole("heading", { name: "Илья Воронцов" })).toBeVisible()
  const relationPicker = page.getByRole("button", { name: "Найти и связать заявку" })
  if (!await relationPicker.isVisible()) await page.getByRole("button", { name: /Показать детали/ }).click()
  await expect(relationPicker).toBeVisible()
  return relationPicker
}

async function unlinkRelationIfPresent(page: Page) {
  await page.goto(seededBookingPath)
  await showRelationPicker(page)
  const unlink = page.getByRole("button", { name: /^Убрать связь:/ })
  if (!await unlink.isVisible()) return
  const responsePromise = relationResponse(page, "/lead-link/unlink")
  await unlink.click()
  expect((await responsePromise).status()).toBe(201)
  await expect(unlink).not.toBeVisible()
}

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

test("booking lead relation persists across desktop and mobile reloads", async ({ page }) => {
  await login(page)
  await unlinkRelationIfPresent(page)

  const unlink = page.getByRole("button", { name: /^Убрать связь: Заявка #.*Илья Воронцов/ })
  try {
    await page.getByRole("button", { name: "Найти и связать заявку" }).click()
    await page.getByPlaceholder("#ID, телефон или имя…").fill("Илья Воронцов")
    const leadOption = page.getByText(/^Заявка #.* · Илья Воронцов$/).first()
    await expect(leadOption).toBeVisible()

    const linkResponsePromise = relationResponse(page, "/lead-link")
    await leadOption.click()
    expect((await linkResponsePromise).status()).toBe(201)
    await expect(unlink).toBeVisible()
    await expect(page.getByText("Сохранено")).toBeVisible()

    await page.reload()
    await expect(unlink).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    const selectedRelation = page.getByRole("button", { name: /^Заявка #.*Илья Воронцов/ })
    if (!await selectedRelation.isVisible()) await page.getByRole("button", { name: /Показать детали/ }).click()
    await expect(selectedRelation).toBeVisible()
    await selectedRelation.click()
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/i)
    await page.goBack()
    await expect(unlink).toBeVisible()
  } finally {
    await unlinkRelationIfPresent(page)
    await page.reload()
    await showRelationPicker(page)
    await expect(page.getByText("Не привязана")).toBeVisible()
  }
})
