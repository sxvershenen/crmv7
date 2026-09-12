import { expect, test } from "@playwright/test"

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
    const review = page.getByRole("button", { name: "Отзыв: Второй гость из CMS" })
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
