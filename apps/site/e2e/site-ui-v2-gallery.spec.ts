import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/site-ui-v2", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Public UI kit v2" })).toBeVisible()
  await expect(page.locator('astro-island[component-url*="SiteUiV2GalleryIsland"]')).not.toHaveAttribute("ssr", "")
})

test("is composed from the same homepage components, without the legacy samples", async ({ page }) => {
  await expect(page.locator('astro-island[component-url*="SiteUiFoundationsIsland"]')).toHaveCount(0)
  for (const heading of [
    "Hero и промокоды",
    "Заголовки секций главной",
    "События и social CTA",
    "Карточки домиков",
    "SPA-card: описание и add-state",
    "Программы и направления",
    "Площадки",
    "Отзывы гостей",
    "Карта базы",
    "Как доехать и что спросить",
    "Соберите свой выезд",
    "Идеи и советы",
  ]) await expect(page.getByRole("heading", { name: heading }).first()).toBeAttached()

  for (const component of ["programs", "venues", "reviews", "map", "faq", "calculator"]) {
    await expect(page.locator(`[data-gallery-component="${component}"]`)).toBeAttached()
  }
  await expect(page.getByRole("contentinfo")).toBeAttached()
})

test("shares semantic component markers with the homepage", async ({ page }) => {
  const galleryMarkers = await page.locator("[data-site-component]").evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-site-component")))].filter(Boolean))
  for (const marker of ["hero", "section-heading", "action-heading", "responsive-rail", "spa-card", "pagination", "booking-calculator"]) expect(galleryMarkers).toContain(marker)
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const homeMarkers = await page.locator("[data-site-component]").evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-site-component")))].filter(Boolean))
  for (const marker of galleryMarkers) expect(homeMarkers).toContain(marker)
})

test("keeps actual hero, SPA, sort, dropdown, FAQ and calculator states live", async ({ page }) => {
  const hero = page.locator("#hero")
  await hero.getByRole("button", { name: "Забронировать" }).click()
  await hero.getByRole("button", { name: /^ВКонтакте/ }).click()
  await expect(page.getByRole("dialog", { name: "Забронировать отдых" })).toBeVisible()
  await page.keyboard.press("Escape")

  const spa = page.locator('section[aria-labelledby="v2-spa-title"]')
  await expect(spa.locator(".site-spa-tab-rail")).toHaveCount(0)
  await expect(spa.locator(".site-spa-card__content")).toContainText(/парная/i)
  await spa.getByRole("button", { name: "Добавить", exact: true }).click()
  await expect(spa.getByRole("button", { name: "Добавлено", exact: true })).toBeVisible()

  const programs = page.locator('[data-gallery-component="programs"]')
  await programs.getByRole("button", { name: "По популярности" }).click()
  await expect(programs.getByRole("button", { name: "По названию" })).toBeVisible()
  await programs.getByRole("button", { name: "По названию" }).click()

  const venues = page.locator('[data-gallery-component="venues"]')
  await venues.getByRole("button", { name: "Все площадки (5)" }).click()
  await venues.getByRole("button", { name: "До 30", exact: true }).click()
  await venues.getByRole("button", { name: "Любой формат" }).click()
  await expect(venues.getByRole("button", { name: "На улице" })).toBeVisible()

  const faq = page.locator('[data-gallery-component="faq"]')
  const faqButton = faq.getByRole("button", { name: "Что входит в стоимость проживания в домике?" })
  await faqButton.click()
  await expect(faqButton).toHaveAttribute("aria-expanded", "true")

  const quiz = page.locator('[data-gallery-component="calculator"]')
  await expect(quiz.getByRole("button", { name: "Контакты", exact: true })).toHaveCount(0)
  await expect(quiz.getByPlaceholder("Ваше имя")).toBeVisible()
  await quiz.getByRole("button", { name: /^Далее/ }).click()
  await expect(quiz.getByRole("button", { name: "Предыдущий месяц" })).toBeVisible()
})

test("uses the real blog cards and has no route runtime errors", async ({ page }) => {
  const blog = page.locator("#blog")
  await expect(blog).toBeVisible()
  await expect(blog.locator(".site-article-card__media")).toHaveCount(4)
  await expect(blog.locator(".site-article-card--compact")).toHaveCount(6)

  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()) })
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(page.locator('astro-island[component-url*="SiteUiV2GalleryIsland"]')).not.toHaveAttribute("ssr", "")
  expect(errors).toEqual([])
})
