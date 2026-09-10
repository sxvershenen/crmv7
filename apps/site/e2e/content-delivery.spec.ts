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
  const errors: Error[] = []
  page.on("pageerror", (error) => errors.push(error))
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
    await expect(page.locator('astro-island[component-url*="NavigationIsland"]')).not.toHaveAttribute("ssr", "")
  }
  expect(errors).toEqual([])
})

test("serves built CSS and JavaScript without exposing source files", async ({ page, request }) => {
  test.skip(process.env.SITE_TEST_RUNTIME !== "production", "Production asset delivery")
  await page.goto("/cms-test")
  const cssUrl = await page.locator('link[rel="stylesheet"][href^="/_astro/"]').first().getAttribute("href")
  const scriptUrl = await page.locator('astro-island[component-url*="NavigationIsland"]').getAttribute("component-url")
  for (const [url, contentType] of [[cssUrl, /text\/css/], [scriptUrl, /javascript/]] as const) {
    expect(url).toBeTruthy()
    const asset = await request.get(url!)
    expect(asset.status()).toBe(200)
    expect(asset.headers()["content-type"]).toMatch(contentType)
  }
  const source = await request.get("/src/lib/content/source.ts")
  expect(source.status()).not.toBe(200)
  expect(await source.text()).not.toContain("createPublicContentSource")
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

test("binds published partners in SSR with the authored item order and no fixture names", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=partners-published")
  for (const path of ["/", "/cms-test"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("Наши опубликованные партнёры")
    expect(html).not.toContain("Вятка Банк")
    await page.goto(path)
    await expect(page.locator("#partners")).toContainText("Совместные проекты из CMS")
    expect(await page.locator("#partners [data-partner-item]").allTextContents()).toEqual(["Пекарня из CMS", "Кофейня из CMS", "Пекарня из CMS", "Кофейня из CMS"])
    expect(await page.locator("#partners").evaluate((element) => element.closest("astro-island") === null)).toBe(true)
    await expect(page.locator("h1")).toHaveCount(1)
  }
})

for (const scenario of ["partners-empty", "partners-blank", "partners-duplicate", "partners-private", "partners-version", "partners-renderer"]) {
  test(`rejects ${scenario} before rendering the page`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    for (const path of ["/", "/cms-test"]) {
      const response = await request.get(path)
      expect(response.status()).toBe(503)
      const html = await response.text()
      expect(html).not.toContain("Пекарня из CMS")
      expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    }
  })
}

test("keeps a long published partners title within the viewport", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=partners-long")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.locator("#partners")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("binds published why-us copy in SSR without fixture facts", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=why-us-published")
  for (const path of ["/", "/cms-test"]) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain("Доказательства из CMS")
    expect(html).not.toContain("30 мин")
    await page.goto(path)
    await expect(page.locator("#why-us")).toContainText("Почему выбирают нас из CMS")
    await expect(page.locator("#why-us")).toContainText("9 мин От нового места")
    await expect(page.locator("#why-us")).toContainText("Редакционный заголовок команды")
    await expect(page.locator("h1")).toHaveCount(1)
  }
})

for (const scenario of ["why-us-empty", "why-us-blank", "why-us-duplicate", "why-us-private", "why-us-version", "why-us-renderer"]) {
  test(`rejects ${scenario} before rendering the page`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    for (const path of ["/", "/cms-test"]) {
      const response = await request.get(path)
      expect(response.status()).toBe(503)
      const html = await response.text()
      expect(html).not.toContain("Доказательства из CMS")
      expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    }
  })
}

test("keeps a long published why-us title within the viewport", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=why-us-long")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.locator("#why-us")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("renders the ordered homepage section snapshot from CMS", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=homepage-published")
  const response = await request.get("/")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("События из CMS")
  expect(html).toContain("Калькулятор из CMS")
  await page.goto("/")
  await expect(page.locator("#events")).toContainText("События из CMS")
  await expect(page.locator("#map")).toContainText("Карта из CMS")
  expect(await page.locator('[data-section-key]').evaluateAll((sections) => sections.map((section) => section.getAttribute("data-section-key")).filter(Boolean))).toEqual([
    "events", "houses", "sauna-chan", "programs", "venues", "blog", "reviews", "map", "faq", "calculator", "footer",
  ])
  await expect(page.locator("footer")).toBeVisible()
})

for (const scenario of ["homepage-empty", "homepage-private", "homepage-duplicate", "homepage-version", "homepage-renderer"]) {
  test(`rejects ${scenario} before rendering the homepage`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/")
    expect(response.status()).toBe(503)
    const html = await response.text()
    expect(html).not.toContain("События из CMS")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
  })
}

test("keeps a long homepage section title within the viewport", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=homepage-long")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.locator("#events")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("binds a house route to CMS content and a same-release safe operational projection", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=house-published")
  const response = await request.get("/houses/forest")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Домик из CMS")
  await page.goto("/houses/forest")
  await expect(page.locator("h1")).toHaveText("Домик из CMS")
  await expect(page.locator('[data-route-kind="house"]')).toContainText("до 4 гостей")
  await expect(page.locator('[data-route-kind="house"]')).toContainText(/6\s500/)
  await expect(page.locator('[data-route-kind="house"] [data-site-action="booking"]')).toBeVisible()
  await expect(page.locator("meta[name=robots]")).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid house route request-only when price authority is absent", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=house-empty")
  const response = await page.goto("/houses/forest")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="house"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="house"]')).toContainText("Уточним доступность")
})

for (const scenario of ["house-missing", "house-outage", "house-private", "house-invalid", "house-version", "house-wrong-path"]) {
  test(`fails closed for ${scenario} house delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/houses/forest")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Домик из CMS")
  })
}
