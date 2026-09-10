import { expect, test } from "@playwright/test"
import { usesFixtureContent } from "../src/lib/content/source"

test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=published")
})

test("fixture content requires an explicit development flag", () => {
  expect(usesFixtureContent({ DEV: false, SITE_CONTENT_SOURCE: "fixture" })).toBe(false)
  expect(usesFixtureContent({ DEV: true })).toBe(false)
  expect(usesFixtureContent({ DEV: true, SITE_CONTENT_SOURCE: "cms" })).toBe(false)
  expect(usesFixtureContent({ DEV: true, SITE_CONTENT_SOURCE: "fixture" })).toBe(true)
})

test("renders release content in SSR and respects disabled hero and absent blog", async ({ page, request }) => {
  for (const path of ["/", "/cms-test"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain("Опубликованный заголовок")
    await page.goto(path)
    await expect(page.locator("h1")).toHaveText("Опубликованный заголовок")
    await expect(page).toHaveTitle("SEO опубликованной страницы")
    await expect(page.locator("#hero, #blog")).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("Глобальный hero не должен воскреснуть")
    await expect(page.getByText("Раздел из CMS", { exact: true }).first()).toBeAttached()
  }
})

for (const scenario of ["outage", "timeout", "disconnect", "redirect", "invalid", "invalid-json", "proxy-not-found", "settings-missing", "mixed-settings", "wrong-path", "not-ready"]) {
  test(`fails closed for ${scenario} without an indexable fallback`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    for (const path of ["/", "/cms-test"]) {
      const response = await request.get(path)
      expect(response.status()).toBe(503)
      expect(response.headers()["cache-control"]).toBe("no-store")
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
      expect(response.headers()["retry-after"]).toBe("60")
      const html = await response.text()
      expect(html).toContain("Сайт временно недоступен")
      for (const forbidden of ["PRIVATE_BACKEND_DETAIL", "PRIVATE_DRAFT_CONTENT", "ModalHub", 'id="houses"', 'type="application/ld+json"']) expect(html).not.toContain(forbidden)
    }
  })
}

test("only an API not-found response produces a 404", async ({ request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=not-found")
  for (const path of ["/", "/cms-test"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(404)
    expect(response.headers()["retry-after"]).toBeUndefined()
    expect(await response.text()).toContain("Страница не найдена")
  }
})

for (const scenario of ["listing-outage", "listing-missing", "listing-mixed", "listing-wrong-path"]) {
  test(`does not render a partial page for ${scenario}`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/cms-test")
    expect(response.status()).toBe(503)
    expect(await response.text()).not.toContain("Опубликованный ресурс")
  })
}

test("renders a same-release listing and accepts an empty published catalog", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=listing-published")
  const response = await request.get("/cms-test")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Опубликованный ресурс")
  await page.goto("/cms-test")
  await expect(page.locator("h1")).toHaveCount(1)
  await expect(page.locator('a[href="/resources/published"]').first()).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow")
  await request.post("http://127.0.0.1:4398/__scenario?name=listing-empty")
  expect((await page.goto("/cms-test"))?.status()).toBe(200)
  await expect(page.locator("h1")).toHaveCount(1)
})

test("error page stays usable with keyboard and narrow screens", async ({ page, request }, testInfo) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=outage")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.locator("h1")).toHaveText("Сайт временно недоступен")
  await expect(page.locator("astro-island")).toHaveCount(0)
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "На главную" })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("content-unavailable.png") })
})
