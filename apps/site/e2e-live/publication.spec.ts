import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

const adminBase = "http://127.0.0.1:3011/api/admin/v1"
const internalBase = "http://127.0.0.1:3011/api/internal/v1"
const publicBase = "http://127.0.0.1:3011/api/public/v1"
const operation = () => ({ operationId: randomUUID(), idempotencyKey: `site-live-${randomUUID()}` })

test("first homepage publication reaches desktop/mobile SSR and rollback restores it", async ({ browser, page, request }) => {
  const login = await request.post(`${internalBase}/auth/login`, { data: { email: "admin@svistoplyasovo.local", password: "change-me-in-local-env" } })
  expect(login.status()).toBe(200)

  const releaseList = await request.get(`${adminBase}/releases`)
  expect(releaseList.status()).toBe(200)
  expect((await releaseList.json()).activeReleaseId, "Use a fresh disposable TEST_DATABASE_URL for the first-publication test").toBeNull()

  const settings = await (await request.get(`${adminBase}/site-settings`)).json()
  const savedSettings = await request.patch(`${adminBase}/site-settings`, { data: {
    ...operation(), expectedVersion: settings.version,
    value: { siteName: "Свистоплясово", headerNavigation: [], heroDefault: null, sectionDefaults: [] },
  } })
  expect(savedSettings.status(), await savedSettings.text()).toBe(200)
  const publishedSettings = await request.post(`${adminBase}/site-settings/publish`, { data: { ...operation(), expectedVersion: (await savedSettings.json()).version } })
  expect(publishedSettings.status(), await publishedSettings.text()).toBe(200)
  const settingsOnly = await request.get(`${adminBase}/releases`)
  expect(settingsOnly.status(), await settingsOnly.text()).toBe(200)
  expect((await settingsOnly.json()).items[0].manifest.routes).toEqual([])

  const homes = await request.get(`${adminBase}/content/nodes?kind=home&limit=10`)
  expect(homes.status()).toBe(200)
  const home = (await homes.json()).items.find((item: { currentRevision?: { route?: { path?: string } } }) => item.currentRevision?.route?.path === "/")
  expect(home).toBeDefined()
  const detail = await (await request.get(`${adminBase}/content/nodes/${home.node.id}`)).json()

  expect((await request.get(`${publicBase}/pages/resolve?path=/`)).status()).toBe(404)
  expect((await request.get("/")).status()).toBe(404)
  const first = await request.post(`${adminBase}/content/nodes/${home.node.id}/publish`, { data: { ...operation(), expectedVersion: detail.node.version } })
  expect(first.status(), await first.text()).toBe(200)
  const firstPublication = await first.json()

  const firstHtml = await request.get("/")
  expect(firstHtml.status()).toBe(200)
  expect(await firstHtml.text()).toContain("Отдых, который начинается с тишины")
  await page.goto("/")
  await expect(page.locator("h1")).toHaveText("Отдых, который начинается с тишины")

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const mobilePage = await mobile.newPage()
    await mobilePage.goto("http://127.0.0.1:4328/")
    await expect(mobilePage.locator("h1")).toHaveText("Отдых, который начинается с тишины")
    expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  } finally { await mobile.close() }

  const edited = await request.patch(`${adminBase}/content/nodes/${home.node.id}`, { data: {
    ...operation(), expectedVersion: firstPublication.node.version, title: "Главная: новая редакция",
    hero: { ...detail.currentRevision.hero, config: { ...detail.currentRevision.hero.config, title: "Новая редакция главной" } },
  } })
  expect(edited.status(), await edited.text()).toBe(200)
  const second = await request.post(`${adminBase}/content/nodes/${home.node.id}/publish`, { data: { ...operation(), expectedVersion: (await edited.json()).node.version } })
  expect(second.status(), await second.text()).toBe(200)
  const secondPublication = await second.json()
  await page.reload()
  await expect(page.locator("h1")).toHaveText("Новая редакция главной")

  const activeResponse = await request.get(`${adminBase}/releases`)
  expect(activeResponse.status(), await activeResponse.text()).toBe(200)
  const active = await activeResponse.json()
  expect(active.activeReleaseId).toBe(secondPublication.publicationId)
  const rollback = await request.post(`${adminBase}/releases/${firstPublication.publicationId}/rollback`, { data: {
    ...operation(), baseReleaseId: active.activeReleaseId, expectedActiveReleaseVersion: active.activeReleaseVersion,
  } })
  expect(rollback.status(), await rollback.text()).toBe(200)
  await page.reload()
  await expect(page.locator("h1")).toHaveText("Отдых, который начинается с тишины")
  const restored = await (await request.get(`${publicBase}/pages/resolve?path=/`)).json()
  expect(restored.releaseId).toBe((await rollback.json()).manifest.id)
  expect(restored.releaseId).not.toBe(firstPublication.publicationId)
})
