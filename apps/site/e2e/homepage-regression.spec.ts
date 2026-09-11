import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hero")).toBeVisible();
  await expect(page.locator("#events")).toBeAttached();
  await expect(page.locator("#blog")).toBeVisible();
  await expect(page.locator('astro-island[component-url*="HeroIsland"]')).not.toHaveAttribute("ssr", "");
  await expect(page.locator('astro-island[component-url*="ModalHub"]')).not.toHaveAttribute("ssr", "");
  expect(pageErrors).toEqual([]);
});

test("keeps the restored homepage structure and typography", async ({ page }, testInfo) => {
  for (const id of [
    "hero",
    "events",
    "houses",
    "sauna",
    "programs",
    "venues",
    "blog",
    "reviews",
    "map",
    "location",
    "quiz",
  ]) {
    await expect(page.locator(`#${id}`), `${id} section`).toBeAttached();
  }

  const heroTitle = page.locator("#hero h1");
  await expect(heroTitle).toHaveText("Глэмпинг в Кирове — дома с чаном и баней");

  if (testInfo.project.name === "desktop-chromium") {
    await expect(heroTitle).toHaveCSS("font-size", "44px");
    await expect(page.locator("#events h2")).toHaveCSS("font-size", "32px");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.locator('aside.fixed[aria-label="Основная навигация"]')).toBeVisible();
  } else {
    await expect(heroTitle).toHaveCSS("font-size", "32px");
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.locator('aside.fixed[aria-label="Основная навигация"]')).toBeHidden();
  }
});

test("keeps the requested responsive presentation details", async ({ page }, testInfo) => {
  const houses = page.locator("#houses");
  await expect(houses.locator('[title*="Свобод"], [title*="Занят"]')).toHaveCount(0);
  await expect(houses.getByText("за ночь от", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#sauna").getByText("за час от", { exact: true }).first()).toBeAttached();

  for (const sectionId of ["programs", "venues", "blog"]) {
    await expect(page.locator(`#${sectionId} .site-home-heading__eyebrow`)).toHaveCount(0);
  }
  await expect(page.locator("#blog .site-article-card__media")).toHaveCount(4);
  await expect(page.locator("#blog .site-article-card--compact")).toHaveCount(6);
  for (const month of await page.locator("#events [data-event-month]").allTextContents()) expect(month).toMatch(/^[А-ЯЁ]{3}$/);
  for (const count of ["14 программ", "8 локаций и пакетов", "22 авторских квеста", "16 душевных программ"]) await expect(page.locator("#programs")).not.toContainText(count);
  await expect(page.locator("#sauna .site-spa-tab-rail")).toHaveCount(0);
  await expect(page.locator("#sauna .site-spa-card__content").first()).toBeVisible();
  await expect(page.locator("#events").getByRole("link", { name: "Перейти в сообщество" })).toBeVisible();

  const mapAction = page.locator('#map button[title="Забронировать"]');
  await expect(mapAction).toHaveCount(1);
  await expect(mapAction.locator("xpath=..").locator("img")).toHaveCount(1);
  await expect(page.locator("#map")).not.toContainText("Открыть страницу");

  if (testInfo.project.name === "mobile-chromium") {
    const hero = page.locator("#hero > div").first();
    const distance = page.locator("#hero .site-hero__distance-badge");
    const slideChooser = page.getByRole("button", { name: "Слайд 1" }).locator("xpath=parent::div");
    const [heroBox, distanceBox, slideChooserBox] = await Promise.all([hero.boundingBox(), distance.boundingBox(), slideChooser.boundingBox()]);
    expect(heroBox).not.toBeNull();
    expect(distanceBox).not.toBeNull();
    expect(slideChooserBox).not.toBeNull();
    expect(Math.abs(distanceBox!.x - heroBox!.x - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(distanceBox!.y - heroBox!.y - 20)).toBeLessThanOrEqual(1);
    expect(slideChooserBox!.x).toBeGreaterThan(distanceBox!.x + distanceBox!.width);
    await expect(page.locator("#hero .site-hero__actions")).toHaveCSS("flex-wrap", "nowrap");
    await expect(page.locator("#hero .site-hero__action-label").first()).toBeHidden();
    await expect(page.locator("#hero").getByText("Мероприятия", { exact: true })).toBeVisible();
    await expect(page.locator("#hero > div").first()).toHaveCSS("border-top-left-radius", "0px");
    await expect(mapAction).toBeHidden();
    await expect(page.locator("#hero .site-promo-card__title").first()).toHaveCSS("font-size", "20px");
    await expect(page.locator("#programs .site-program-card__description").first()).toHaveCSS("-webkit-line-clamp", "1");
    await expect(page.locator("#quiz").getByText("Предварительная цена", { exact: true }).first()).toHaveCSS("text-transform", "none");
    const bookingWidth = await page.locator("#hero .site-hero__action").evaluate((element) => element.getBoundingClientRect().width);
    expect(bookingWidth).toBeGreaterThanOrEqual(55);
    expect(bookingWidth).toBeLessThanOrEqual(57);
  } else {
    const heroBox = await page.locator("#hero > div").first().boundingBox();
    const chooserBox = await page.locator("#hero").getByRole("button", { name: /^Провести мероприятие/ }).boundingBox();
    expect(heroBox).not.toBeNull();
    expect(chooserBox).not.toBeNull();
    expect(Math.abs(heroBox!.y + heroBox!.height - chooserBox!.y - chooserBox!.height - 32)).toBeLessThanOrEqual(2);
    for (const card of await page.locator("#blog .site-article-card--compact").all()) {
      const box = await card.boundingBox();
      expect(box?.height).toBeLessThanOrEqual(92);
    }
  }
});

test("has no mobile document overflow while the reusable swipe hint runs", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = () => page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  await expect.poll(widths).toEqual({ client: 390, scroll: 390 });
  const rail = page.locator('#sauna [data-site-component="responsive-rail"]');
  await rail.scrollIntoViewIfNeeded();
  await expect.poll(() => rail.getAttribute("data-swipe-hint")).toBe("playing");
  await expect.poll(widths).toEqual({ client: 390, scroll: 390 });
  await expect.poll(() => rail.getAttribute("data-swipe-hint"), { timeout: 2500 }).toBe("done");
  await expect.poll(widths).toEqual({ client: 390, scroll: 390 });
});

test("copies a promo from the whole card and applies it to intake", async ({ page }) => {
  const promo = page.getByRole("button", { name: "Скопировать промокод GLAMP3000" });
  await promo.click();
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect.poll(() => quiz.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await expect(quiz.getByPlaceholder("Введите промокод")).toHaveValue("GLAMP3000");
  await expect(quiz).toHaveAttribute("data-applied-promo", "GLAMP3000");
  await expect(quiz.locator("[data-calculated-price]:visible").first()).toHaveText("8 000 ₽");
});

test("keeps the approved homepage presentation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
  await expect(page.locator("#hero img").first()).toBeVisible();
  await page.getByRole("button", { name: "Слайд 1" }).click();

  await expect(page).toHaveScreenshot("homepage-approved.png", {
    animations: "disabled",
    mask: [
      page.locator("img"),
      page.locator('astro-island[component-url*="FloatingHelperIsland"]'),
      page.getByRole("button", { name: "Написать менеджеру в ВК" }),
      page.locator('#hero [role="button"] > div > div:first-child'),
    ],
    maxDiffPixelRatio: 0.001,
  });
});

test("keeps the approved full homepage presentation", async ({ page }) => {
  if (test.info().project.name === "mobile-chromium") {
    await page.setViewportSize({ width: 416, height: 915 });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
  await page.getByRole("button", { name: "Слайд 1" }).click();

  await expect(page).toHaveScreenshot("homepage-approved-full.png", {
    animations: "disabled",
    fullPage: true,
    mask: [
      page.locator("img"),
      page.locator('astro-island[component-url*="FloatingHelperIsland"]'),
      page.getByRole("button", { name: "Написать менеджеру в ВК" }),
      page.locator('#hero [role="button"] > div > div:first-child'),
    ],
    maxDiffPixelRatio: 0.001,
  });
});

test("hydrates booking, call and section interactions", async ({ page }) => {
  const hero = page.locator("#hero");
  await hero.getByRole("button", { name: "Забронировать", exact: true }).click();
  await hero.getByRole("button", { name: /^ВКонтакте/ }).click();

  const bookingDialog = page.getByRole("dialog", { name: "Забронировать отдых" });
  await expect(bookingDialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.getByRole("button", { name: "Закрыть" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(bookingDialog).toBeHidden();

  const sauna = page.locator("#sauna");
  await sauna.scrollIntoViewIfNeeded();
  await expect
    .poll(() => sauna.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr")))
    .toBe(true);
  await expect(sauna.locator(".site-spa-tab-rail")).toHaveCount(0);
  await expect(sauna.locator(".site-spa-card__content").first()).toContainText(/парная/i);
});

test("selects an accessible contiguous date range and serializes it", async ({ page }) => {
  const quiz = page.locator("#quiz");
  await quiz.scrollIntoViewIfNeeded();
  await expect.poll(() => quiz.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await expect(quiz.getByRole("button", { name: "Контакты", exact: true })).toHaveCount(0);
  await expect(quiz.getByPlaceholder("Ваше имя")).toBeVisible();
  await quiz.getByRole("button", { name: /^Далее/ }).click();
  await quiz.locator('[data-calendar-day="12"]').click();
  await quiz.locator('[data-calendar-day="16"]').click();
  await expect(quiz).toHaveAttribute("data-date-start", "2026-09-12");
  await expect(quiz).toHaveAttribute("data-date-end", "2026-09-16");
  await expect(quiz.locator('[data-calendar-day="13"]')).toHaveAttribute("data-range-position", "within");
  await expect(quiz.locator('[data-calendar-day="16"]')).toHaveAttribute("data-range-position", "endpoint");
  await expect(quiz.locator('[data-date-summary]:visible').first()).toContainText("12–16 сентября");
  await expect(quiz.locator('input[name="dateStart"]')).toHaveValue("2026-09-12");
  await expect(quiz.locator('input[name="dateEnd"]')).toHaveValue("2026-09-16");
  await expect(quiz.locator('[data-calendar-day="17"]')).toBeDisabled();
  await quiz.locator('[data-calendar-day="18"]').click();
  await expect(quiz).toHaveAttribute("data-date-start", "2026-09-18");
  await expect(quiz).toHaveAttribute("data-date-end", "");
  await quiz.locator('[data-calendar-day="24"]').click();
  await expect(quiz).toHaveAttribute("data-date-end", "");
});

test("reveals once, keeps partners inset and uses forgiving helper hover", async ({ page }, testInfo) => {
  const blog = page.locator("#blog");
  await blog.scrollIntoViewIfNeeded();
  const reveal = blog.locator("xpath=ancestor-or-self::*[@data-site-reveal-state][1]");
  await expect(reveal).toHaveAttribute("data-site-reveal-state", /revealed|complete/);
  await expect(reveal).toHaveCSS("opacity", "1");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const partners = page.locator("#partners");
  await partners.scrollIntoViewIfNeeded();
  const viewport = partners.locator("[data-partners-viewport]");
  await expect(viewport).toHaveCSS("padding-left", "6px");
  await expect(viewport).toHaveCSS("padding-right", "6px");

  const helper = page.locator('[data-site-component="floating-helper"]');
  if (testInfo.project.name === "desktop-chromium") {
    await expect(helper).toBeVisible();
    const button = helper.getByRole("button", { name: "Написать менеджеру в ВК" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    expect((await button.boundingBox())?.width).toBe(48);
    await helper.hover();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await button.boundingBox())?.width).toBeGreaterThan(280);
    await page.mouse.move(600, 40);
    await expect(button).toHaveAttribute("aria-expanded", "false", { timeout: 1000 });
    await expect.poll(async () => Math.round((await button.boundingBox())?.width ?? 0)).toBe(48);
  } else {
    await expect(helper).toBeHidden();
    const mobileHelper = page.getByRole("button", { name: "Написать менеджеру в ВК" });
    expect(Math.round((await mobileHelper.boundingBox())?.width ?? 0)).toBe(48);
  }
});

test("keeps catalog, review, map and FAQ interactions", async ({ page }, testInfo) => {
  const programs = page.locator("#programs");
  await programs.scrollIntoViewIfNeeded();
  await expect.poll(() => programs.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await programs.getByText("Свадьбы на природе", { exact: true }).click();
  await expect(programs).toContainText("Свадебный уикенд «Лесная сказка»");
  await programs.getByText("Свадебный уикенд «Лесная сказка»").click();
  await expect(page.getByRole("dialog", { name: "Забронировать отдых" })).toContainText("Программа:");
  await page.keyboard.press("Escape");

  const venues = page.locator("#venues");
  await venues.scrollIntoViewIfNeeded();
  await expect.poll(() => venues.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await venues.locator("button").first().click();
  await venues.getByRole("button", { name: "От 70", exact: true }).click();
  await expect(venues).toContainText("Амфитеатр и сцена");
  await expect(venues).not.toContainText("Панорамная веранда");

  const reviews = page.locator("#reviews");
  await reviews.scrollIntoViewIfNeeded();
  await expect.poll(() => reviews.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  const reviewCard = reviews.getByRole("button", { name: "Отзыв: Екатерина и Дмитрий" });
  if (testInfo.project.name === "desktop-chromium") {
    await reviewCard.hover();
    await expect(reviewCard).toHaveAttribute("aria-expanded", "true");
  }
  await reviewCard.click();
  await expect(reviewCard).toHaveAttribute("aria-expanded", testInfo.project.name === "desktop-chromium" ? "false" : "true");

  const map = page.locator("#map");
  await map.scrollIntoViewIfNeeded();
  await expect.poll(() => map.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await map.locator("button.chip", { hasText: "Тёплая юрта" }).click();
  await expect(map.locator("h3")).toHaveText("Тёплая юрта");
  const activeMapChip = map.locator("button.chip", { hasText: "Тёплая юрта" });
  await expect(activeMapChip).toHaveAttribute("aria-pressed", "true");
  await expect(activeMapChip).toHaveCSS("color", "rgb(255, 255, 255)");

  const location = page.locator("#location");
  await location.scrollIntoViewIfNeeded();
  await expect.poll(() => location.evaluate((element) => !element.closest("astro-island")?.hasAttribute("ssr"))).toBe(true);
  await location.getByRole("button", { name: "Что входит в стоимость проживания в домике?" }).click();
  await expect(location).toContainText("постельное белье премиум-класса");
});

test("retires the prototype resource route without a temporary redirect", async ({ page, request }) => {
  const legacy = await request.get("/resources/sauna-chan", { maxRedirects: 0 });
  expect(legacy.status()).toBe(301);
  expect(legacy.headers().location).toBe("/dopy/sauna-chan");

  const unknown = await page.goto("/resources/sauna", { waitUntil: "domcontentloaded" });
  expect(unknown?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});

test("keeps the unfinished privacy page out of the search index", async ({ page, request }) => {
  const sitemap = await request.get("/sitemap-index.xml");
  expect(await sitemap.text()).not.toContain("/privacy");

  await page.goto("/privacy", { waitUntil: "domcontentloaded" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
});
