import { expect, test } from "@playwright/test"

test("renders the homepage text block from the active CMS release", async ({ request, page }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=homepage-editorial")
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  await expect(page.locator(".site-editorial-content")).toContainText("Текст главной из CMS.")
  await expect(page.locator(".site-editorial-content h2")).toHaveText("Добро пожаловать")
})

test("renders release-owned reviews and FAQ in authored order and supports keyboard", async ({ request, page }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=details-published")
  for (const path of ["/", "/cms-test"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("Второй отзыв из релиза")
    expect(html).toContain("Второй ответ из релиза")
    for (const fixture of ["480+", "Екатерина и Дмитрий", "Зимний вечер в глэмпинге"]) expect(html).not.toContain(fixture)
    await page.goto(path)
    expect(await page.locator("#reviews [data-review-card]").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label")))).toEqual(["Отзыв: Второй гость из CMS", "Отзыв: Первый гость из CMS"])
    await expect(page.locator("#reviews [data-review-summary]")).toContainText("4.5 из 5.0")
    const review = page.getByRole("button", { name: "Отзыв: Второй гость из CMS" })
    await expect(review.locator("img")).toHaveAttribute("src", "https://images.example.test/review-2.webp")
    await expect(review).toContainText("12 февраля 2025")
    await review.scrollIntoViewIfNeeded()
    await expect(page.locator('astro-island[component-url*="ReviewsIsland"]')).not.toHaveAttribute("ssr", "")
    await review.focus()
    await expect(review).toHaveAttribute("aria-expanded", "true")
    await page.keyboard.press("Enter")
    await expect(review).toHaveAttribute("aria-expanded", "false")
    const question = page.getByRole("button", { name: "Первый вопрос из CMS?", exact: true })
    await question.scrollIntoViewIfNeeded()
    await expect(page.locator('astro-island[component-url*="FaqLocationIsland"]')).not.toHaveAttribute("ssr", "")
    await question.focus()
    await page.keyboard.press("Enter")
    await expect(question).toHaveAttribute("aria-expanded", "true")
    await expect(page.getByText("Первый ответ из релиза", { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test("renders CMS directions, sauna cards and review photos without editorial prices", async ({ request, page }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=visual-cards")
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  const sauna = page.locator("#sauna")
  await sauna.scrollIntoViewIfNeeded()
  await expect(sauna).toContainText("Баня из редактора")
  await expect(sauna).toContainText("Чан из редактора")
  await expect(sauna).toContainText("Стоимость уточнит менеджер")
  await expect(sauna).not.toContainText("2 500 ₽")
  await expect(sauna.locator(".site-spa-card__content")).toHaveCount(2)
  await expect(sauna.locator('[data-site-component="spa-card"] .btn-arrow .lucide-plus')).toHaveCount(2)
  const programs = page.locator("#programs")
  await programs.scrollIntoViewIfNeeded()
  await programs.getByText("Семейное направление", { exact: true }).click()
  await expect(programs).toContainText("Программа из CMS")
  const reviews = page.locator("#reviews")
  await reviews.scrollIntoViewIfNeeded()
  await reviews.getByRole("button", { name: "Показать фото: Второе фото из CMS" }).click()
  await expect(reviews.locator("figure figcaption")).toHaveText("Второе фото из CMS")
})

test("plays selected review videos from published CMS links and keeps their poster", async ({ request, page }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=review-video")
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve() }
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")) }
  })
  const response = await page.goto("/")
  expect(response?.status()).toBe(200)
  const reviews = page.locator("#reviews")
  await reviews.scrollIntoViewIfNeeded()
  const video = reviews.locator("video")
  await expect(video).toHaveAttribute("src", "https://media.example.test/first.mp4")
  await expect(video).toHaveAttribute("poster", /\/api\/public\/v1\/media\//)
  await expect(video).toHaveAttribute("preload", "none")
  await reviews.getByRole("button", { name: "Смотреть видео: Первый ролик из CMS" }).click()
  await expect(video).toHaveAttribute("controls", "")
  await reviews.getByRole("button", { name: "Выбрать видео: Второй ролик из CMS" }).click()
  await expect(video).toHaveAttribute("src", "https://media.example.test/second.webm")
  await expect(reviews.getByRole("button", { name: "Смотреть видео: Второй ролик из CMS" })).toBeVisible()
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error("unavailable"))
    HTMLMediaElement.prototype.load = () => {}
  })
  await reviews.getByRole("button", { name: "Смотреть видео: Второй ролик из CMS" }).click()
  await expect(reviews.getByRole("alert")).toContainText("Видео не загрузилось")
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve() }
  })
  await reviews.getByRole("button", { name: "Повторить" }).click()
  await expect(video).toHaveAttribute("controls", "")
})

for (const scenario of ["empty", "absent"]) {
  test(`hides ${scenario} review and FAQ content without fixture fallback`, async ({ request, page }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=details-${scenario}`)
    await page.goto("/")
    await expect(page.locator("#reviews, #location")).toHaveCount(0)
  })
}

for (const scenario of ["blank", "rating", "duplicate", "private"]) {
  test(`rejects ${scenario} detail data before rendering`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=details-${scenario}`)
    const response = await request.get("/")
    expect(response.status()).toBe(503)
    const html = await response.text()
    expect(html).not.toContain("Второй гость из CMS")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
  })
}
