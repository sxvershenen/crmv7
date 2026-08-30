import { expect, test } from "@playwright/test"

test("tasks expose dashboard, kanban, table and problem flows", async ({ page, isMobile }) => {
  await page.goto("/tasks")
  await expect(page.getByTestId("task-dashboard")).toBeVisible()
  await page.getByRole("tab", { name: "Канбан" }).click()
  await expect(page).toHaveURL(/view=kanban/)
  await expect(page.getByTestId(isMobile ? "mobile-task-cards" : "task-kanban")).toBeVisible()

  await page.getByRole("tab", { name: "Таблица" }).click()
  await expect(page).toHaveURL(/view=table/)
  await expect(page.getByTestId(isMobile ? "mobile-task-cards" : "task-table")).toBeVisible()

  await page.getByRole("tab", { name: "Проблемы" }).click()
  await expect(page).toHaveURL(/view=problems/)
  const problems = page.getByTestId("task-card-list")
  await expect(problems).toBeVisible()
  await expect(problems.getByText("Назначить ответственного за встречу гостя")).toBeVisible()
})

test("tasks remain within the mobile viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only overflow check")
  await page.goto("/tasks?view=kanban")
  await expect(page.getByTestId("mobile-task-cards")).toBeVisible()
  const viewport = page.viewportSize()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(viewport?.width ?? width)
})

test("desktop task kanban uses drag overlay and a destination placeholder", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop DnD representation")
  await page.goto("/tasks?view=kanban")

  const source = page.getByRole("button", { name: /Открыть задачу T-184/ })
  const destination = page.getByRole("region", { name: /В работе: 2/ })
  const sourceBox = await source.boundingBox()
  const destinationBox = await destination.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(destinationBox).not.toBeNull()

  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 16)
  await page.mouse.down()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 12, sourceBox!.y + 28, { steps: 3 })
  await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + destinationBox!.height - 24, { steps: 8 })

  await expect(page.getByTestId("task-drag-overlay")).toBeVisible()
  await expect(page.getByTestId("task-drop-placeholder:in_progress")).toBeVisible()
  await page.mouse.up()
  await expect(page.getByRole("region", { name: /В работе: 3/ })).toBeVisible()
})

test("task editor keeps quick actions, shared chrome and equal form controls", async ({ page, isMobile }) => {
  await page.goto("/tasks/T-184")
  await expect(page.getByRole("heading", { level: 1, name: "Уточнить финальный состав гостей" })).toBeVisible()
  await expect(page.getByText("#T-184", { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="editor-actionbar"]')).toHaveCSS("position", "fixed")
  await expect(page.locator('[data-slot="editor-sidebar"]').getByText("Статус", { exact: true })).toHaveCount(0)
  if (isMobile) {
    await expect(page.locator('[data-slot="editor-mobile-status"]')).toBeVisible()
    await expect(page.locator('[data-slot="editor-nav-fade"]')).toBeVisible()
  } else {
    await expect(page.getByRole("button", { name: "Завершить задачу" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Перенести задачу на завтра" })).toBeVisible()
    await expect(page.getByRole("button", { exact: true, name: "Сменить исполнителя задачи" })).toBeVisible()
  }
  const deadline = page.getByRole("button", { name: "Дедлайн задачи" })
  const priority = page.getByRole("combobox", { name: "Приоритет задачи" })
  expect((await deadline.boundingBox())?.height).toBe((await priority.boundingBox())?.height)
  await page.getByLabel("Название задачи").fill("Уточнить состав гостей — обновлено")
  await expect(page.getByText("Есть изменения")).toBeVisible()
  await page.getByRole("tab", { name: "Связи" }).click()
  await expect(page).toHaveURL(/tab=relations/)
  await expect(page.getByLabel("Название связанной записи")).toBeVisible()
  if (isMobile) {
    const viewport = page.viewportSize()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(viewport?.width ?? width)
  }
  await page.getByRole("tab", { name: "История" }).click()
  await expect(page).toHaveURL(/tab=history/)
})
