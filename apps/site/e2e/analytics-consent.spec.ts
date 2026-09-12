import { expect, test, type Page } from "@playwright/test";

const ANALYTICS_URL = "**/api/public/v1/analytics/events";
const CONSENT_KEY = "svistoplyasovo.analytics-consent.v1";

type CapturedBatch = {
  events: Array<Record<string, unknown>>;
};

async function captureAnalytics(page: Page) {
  const batches: CapturedBatch[] = [];
  await page.route(ANALYTICS_URL, async (route) => {
    batches.push(route.request().postDataJSON() as CapturedBatch);
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "11111111-1111-4111-8111-111111111111",
        accepted: 1,
        duplicates: 0,
        dropped: 0,
      }),
    });
  });
  return batches;
}

async function openPrivacySettings(page: Page) {
  await expect(page.locator('astro-island[component-url*="AnalyticsIsland"]')).not.toHaveAttribute("ssr", "");
  await expect(page.locator('astro-island[component-url*="ModalHub"]')).not.toHaveAttribute("ssr", "");
  await page.getByRole("link", { name: "Политика обработки персональных данных", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Политика обработки персональных данных и согласие" })).toBeVisible();
}

test("refuses analytics without sending or retaining hidden events", async ({ page }) => {
  const batches = await captureAnalytics(page);
  await page.goto("/?campaign=private#hero", { waitUntil: "domcontentloaded" });
  await openPrivacySettings(page);
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBeNull();
  expect(batches).toEqual([]);

  await openPrivacySettings(page);
  await page.getByRole("button", { name: "Только необходимые" }).click();

  await expect(page.getByRole("dialog", { name: "Политика обработки персональных данных и согласие" })).toBeHidden();
  await expect.poll(() => page.evaluate((key) => {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as unknown : null;
  }, CONSENT_KEY)).toMatchObject({
    state: "denied",
    policyVersion: "v1",
    timestamp: expect.any(String),
    source: "privacy-settings",
  });
  const deniedEvidence = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!) as { timestamp: string }, CONSENT_KEY);
  expect(Date.parse((deniedEvidence as { timestamp: string }).timestamp)).not.toBeNaN();

  await page.locator("#events").dispatchEvent("click");
  await page.waitForTimeout(100);
  expect(batches).toEqual([]);
});

test("accepts analytics, sends one page view, and captures allowlisted CTA data", async ({ page }) => {
  const batches = await captureAnalytics(page);
  await page.goto("/?campaign=private#hero", { waitUntil: "domcontentloaded" });
  await openPrivacySettings(page);
  await page.getByRole("button", { name: "Разрешить аналитику" }).click();

  await expect.poll(() => page.evaluate((key) => {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as unknown : null;
  }, CONSENT_KEY)).toMatchObject({
    state: "analytics",
    policyVersion: "v1",
    timestamp: expect.any(String),
    source: "privacy-settings",
  });
  const grantedEvidence = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!) as { timestamp: string }, CONSENT_KEY);
  expect(Date.parse((grantedEvidence as { timestamp: string }).timestamp)).not.toBeNaN();

  await expect.poll(() => batches.length).toBe(1);
  expect(batches[0]?.events).toHaveLength(1);
  expect(batches[0]?.events[0]).toMatchObject({
    eventId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    schemaVersion: 1,
    occurredAt: expect.any(String),
    eventName: "page_view",
    consent: "analytics",
    purpose: "analytics",
    context: {
      path: "/",
      pageNodeId: null,
      releaseId: null,
      referrer: null,
    },
    properties: { kind: "page_view" },
  });

  await page.locator("#events").dispatchEvent("click");
  await expect.poll(() => batches.length).toBe(2);
  expect(batches[1]?.events[0]).toMatchObject({
    eventName: "cta_clicked",
    consent: "analytics",
    purpose: "analytics",
    context: { path: "/" },
    properties: {
      kind: "action",
      actionId: "home.events.view",
      component: "section",
    },
  });
});

test("revokes analytics with an essential denied event and clears consent", async ({ page }) => {
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
  }, [CONSENT_KEY, JSON.stringify({ state: "analytics", policyVersion: "v1" })] as const);
  const batches = await captureAnalytics(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => batches.length).toBe(1);

  await openPrivacySettings(page);
  await expect(page.getByText("Аналитика разрешена.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Отозвать аналитику" }).click();

  await expect.poll(() => batches.length).toBe(2);
  expect(batches[1]?.events[0]).toMatchObject({
    eventName: "consent_changed",
    consent: "denied",
    purpose: "essential",
    context: {
      path: "/",
      pageNodeId: null,
      releaseId: null,
      referrer: null,
    },
    properties: {
      kind: "consent",
      state: "denied",
      policyVersion: "v1",
      timestamp: expect.any(String),
      source: "privacy-settings",
    },
  });
  expect(Date.parse((batches[1]?.events[0]?.properties as { timestamp: string }).timestamp)).not.toBeNaN();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), CONSENT_KEY)).toBeNull();

  await page.locator("#events").dispatchEvent("click");
  await page.waitForTimeout(100);
  expect(batches).toHaveLength(2);
});
