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

test("serves one-hop legacy redirects and release-derived crawl controls", async ({ request }) => {
  const redirect = await request.get("/houses/forest", { maxRedirects: 0 })
  expect(redirect.status()).toBe(301)
  expect(redirect.headers().location).toBe("/domiki/forest")
  const sitemap = await request.get("/sitemap-index.xml")
  const xml = await sitemap.text()
  expect(sitemap.status()).toBe(200)
  expect(xml).toContain("/domiki/forest")
  expect(xml).not.toContain("/houses/forest")
  expect(xml).toContain("<lastmod>2026-09-10</lastmod>")
  const robots = await request.get("/robots.txt")
  expect(await robots.text()).toContain("Sitemap: https://svistoplyasovo.ru/sitemap-index.xml")
})

test("renders article and legal bodies as meaningful SSR from the active release", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=editorial")
  await page.goto("/blog/guide")
  await expect(page.locator("h1")).toHaveText("Гид по отдыху")
  await expect(page.locator("h2")).toHaveText("Важно знать")
  expect(await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.map((node) => node.textContent).join("\n"))).toContain('"@type":"Article"')
  const relatedLink = page.getByRole("link", { name: "На главную" })
  for (let index = 0; index < 50 && !await relatedLink.evaluate((element) => element === document.activeElement); index += 1) await page.keyboard.press("Tab")
  await expect(relatedLink).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto("/privacy")
  await expect(page.locator("h1")).toHaveText("Политика конфиденциальности")
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow")
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
  const response = await request.get("/domiki/forest")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Домик из CMS")
  await page.goto("/domiki/forest")
  await expect(page.locator("h1")).toHaveText("Домик из CMS")
  await expect(page.locator('[data-route-kind="house"]')).toContainText("до 4 гостей")
  await expect(page.locator('[data-route-kind="house"]')).toContainText(/6\s500/)
  await expect(page.locator('[data-route-kind="house"] [data-site-action="booking"]')).toBeVisible()
  await expect(page.locator("meta[name=robots]")).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid house route request-only when price authority is absent", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=house-empty")
  const response = await page.goto("/domiki/forest")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="house"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="house"]')).toContainText("Уточним доступность")
})

for (const scenario of ["house-missing", "house-outage", "house-private", "house-invalid", "house-version", "house-wrong-path"]) {
  test(`fails closed for ${scenario} house delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/domiki/forest")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Домик из CMS")
  })
}

test("binds a campground route to CMS content and shared-capacity operational facts", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=campground-published")
  const response = await request.get("/kemping/pitches")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Кемпинг из CMS")
  await page.goto("/kemping/pitches")
  await expect(page.locator("h1")).toHaveText("Кемпинг из CMS")
  await expect(page.locator('[data-route-kind="campground"]')).toContainText("до 15 палаточных мест")
  await expect(page.locator('[data-route-kind="campground"]')).toContainText(/1\s800/)
  await expect(page.locator('[data-route-kind="campground"] [data-site-action="booking"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid campground route request-only when price authority is absent", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=campground-empty")
  const response = await page.goto("/kemping/pitches")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="campground"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="campground"]')).toContainText("Уточним доступность")
})

for (const scenario of ["campground-missing", "campground-outage", "campground-private", "campground-invalid", "campground-version", "campground-wrong-path"]) {
  test(`fails closed for ${scenario} campground delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/kemping/pitches")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Кемпинг из CMS")
  })
}

test("binds a venue route to CMS content and an exclusive-resource operational projection", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=venue-published")
  const response = await request.get("/poshadki/meadow")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Площадка из CMS")
  await page.goto("/poshadki/meadow")
  await expect(page.locator("h1")).toHaveText("Площадка из CMS")
  await expect(page.locator('[data-route-kind="venue"]')).toContainText("до 40 гостей")
  await expect(page.locator('[data-route-kind="venue"]')).toContainText(/3\s200/)
  await expect(page.locator('[data-route-kind="venue"] [data-site-action="booking"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid venue route request-only when price authority is absent", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=venue-empty")
  const response = await page.goto("/poshadki/meadow")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="venue"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="venue"]')).toContainText("Уточним доступность")
})

for (const scenario of ["venue-missing", "venue-outage", "venue-private", "venue-invalid", "venue-version", "venue-wrong-id", "venue-no-dependency"]) {
  test(`fails closed for ${scenario} venue delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/poshadki/meadow")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Площадка из CMS")
  })
}

test("binds a program route to CMS content and the next open occurrence", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=program-published")
  const response = await request.get("/programmy/rafting")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Программа из CMS")
  await page.goto("/programmy/rafting")
  await expect(page.locator("h1")).toHaveText("Программа из CMS")
  await expect(page.locator('[data-route-kind="program"]')).toContainText("от 2 до 20 участников")
  await expect(page.locator('[data-route-kind="program"]')).toContainText(/2\s500/)
  await expect(page.locator('[data-route-kind="program"]')).toContainText("20 сентября 2026")
  await expect(page.locator('[data-route-kind="program"] [data-site-action="booking"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid program route request-only without a price or open occurrence", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=program-empty")
  const response = await page.goto("/programmy/rafting")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="program"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="program"]')).toContainText("Уточним ближайшую дату")
})

for (const scenario of ["program-missing", "program-outage", "program-private", "program-invalid", "program-version", "program-wrong-path", "program-wrong-id", "program-no-dependency"]) {
  test(`fails closed for ${scenario} program delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/programmy/rafting")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Программа из CMS")
  })
}

test("binds an event-service route to a reusable public category without customer order data", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=event-service-published")
  const response = await request.get("/meropriyatiya/corporate")
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain("Мероприятие из CMS")
  expect(html).not.toContain("resourceSelections")
  expect(html).not.toContain("customerPhone")
  await page.goto("/meropriyatiya/corporate")
  await expect(page.locator("h1")).toHaveText("Мероприятие из CMS")
  await expect(page.locator('[data-route-kind="event-service"]')).toContainText("от 10 до 80 гостей")
  await expect(page.locator('[data-route-kind="event-service"]')).toContainText("По запросу")
  await expect(page.locator('[data-route-kind="event-service"] [data-site-action="booking"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

for (const scenario of ["event-service-missing", "event-service-outage", "event-service-private", "event-service-invalid", "event-service-version", "event-service-wrong-path", "event-service-wrong-id", "event-service-no-dependency"]) {
  test(`fails closed for ${scenario} event-service delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/meropriyatiya/corporate")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Мероприятие из CMS")
  })
}

test("binds an add-on route to the existing release-pinned safe projection", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=addon-published")
  const response = await request.get("/dopy/firewood")
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain("Дополнение из CMS")
  await page.goto("/dopy/firewood")
  await expect(page.locator("h1")).toHaveText("Дополнение из CMS")
  await expect(page.locator('[data-route-kind="addon"]')).toContainText("от 1 до 10 единицы")
  await expect(page.locator('[data-route-kind="addon"]')).toContainText(/1\s200/)
  await expect(page.locator('[data-route-kind="addon"] [data-site-action="booking"]')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test("keeps a valid add-on route request-only when price authority is absent", async ({ page, request }) => {
  await request.post("http://127.0.0.1:4398/__scenario?name=addon-empty")
  const response = await page.goto("/dopy/firewood")
  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-route-kind="addon"]')).toContainText("По запросу")
})

for (const scenario of ["addon-missing", "addon-outage", "addon-private", "addon-invalid", "addon-version", "addon-wrong-id", "addon-no-dependency"]) {
  test(`fails closed for ${scenario} add-on delivery`, async ({ request }) => {
    await request.post(`http://127.0.0.1:4398/__scenario?name=${scenario}`)
    const response = await request.get("/dopy/firewood")
    expect(response.status()).toBe(503)
    expect(response.headers()["cache-control"]).toBe("no-store")
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow")
    const html = await response.text()
    expect(html).toContain("Сайт временно недоступен")
    expect(html).not.toContain("PRIVATE_BACKEND_DETAIL")
    expect(html).not.toContain("Дополнение из CMS")
  })
}
