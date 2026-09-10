import { createServer } from "node:http"
import { URL } from "node:url"

const id = "11111111-1111-4111-8111-111111111111"
const releaseId = "22222222-2222-4222-8222-222222222222"
const nextReleaseId = "33333333-3333-4333-8333-333333333333"
const asOf = "2026-09-10T10:00:00.000Z"
const definition = { id, entityKind: "resource", filters: [], sorts: [], defaultSortId: null, pageSize: 20 }
let scenario = "published"

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4398")
  const send = (body, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(JSON.stringify(body))
  }
  if (url.pathname === "/health") return send({ ok: true })
  if (url.pathname === "/__scenario" && request.method === "POST") {
    scenario = url.searchParams.get("name")
    return send({ scenario })
  }
  if (!url.pathname.startsWith("/api/public/v1/")) return send({ code: "NOT_FOUND" }, 404)
  if (scenario === "outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
  if (scenario === "timeout") return // Intentionally wait for the caller's abort.
  if (scenario === "disconnect") return request.socket.destroy()
  if (scenario === "redirect") {
    response.writeHead(302, { Location: "/health" })
    return response.end()
  }
  if (url.pathname.endsWith("/site-settings")) {
    if (scenario === "settings-missing") return send({ code: "NOT_FOUND" }, 404)
    return send({
      releaseId: scenario === "mixed-settings" ? nextReleaseId : releaseId,
      revisionId: id, contentVersion: "a".repeat(64), publishedAt: asOf,
      value: {
        siteName: "Тестовый опубликованный сайт",
        headerNavigation: [{ id, label: "Раздел из CMS", link: { kind: "internal", path: "/cms-test" } }],
        heroDefault: { title: "Глобальный hero не должен воскреснуть" },
      },
    })
  }
  if (url.pathname.endsWith("/pages/resolve")) {
    if (scenario === "not-found") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "proxy-not-found") return send({ message: "proxy route missing" }, 404)
    if (scenario === "invalid") return send({ title: "PRIVATE_DRAFT_CONTENT" })
    if (scenario === "invalid-json") { response.writeHead(200); return response.end("<html>upstream error</html>") }
    const path = url.searchParams.get("path")
    return send({
      nodeId: id, revisionId: id, releaseId,
      kind: path === "/" ? "home" : "resource_listing",
      path: scenario === "wrong-path" ? "/wrong-path" : path,
      title: "Опубликованный заголовок", summary: "Описание опубликованной страницы", hero: null,
      sections: scenario.startsWith("listing") ? [{
        id, key: "catalog", renderer: "listing", rendererVersion: "1", schemaVersion: 1,
        order: 10, config: { definition },
      }] : [],
      seo: { title: "SEO опубликованной страницы", description: "Описание из CMS", indexPolicy: "index_follow", canonical: { mode: "self" } },
      dependencies: [], generatedAt: asOf,
      cache: { etag: "test-page", maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300, tags: [] },
      freshness: { contentVersion: "a".repeat(64), crmProjectionAsOf: null, ready: scenario !== "not-ready" },
    })
  }
  if (url.pathname.endsWith("/listings/resolve")) {
    if (scenario === "listing-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "listing-outage") return send({ code: "UNAVAILABLE" }, 503)
    return send({
      definition,
      items: scenario === "listing-empty" ? [] : [{ id, kind: "resource", title: "Опубликованный ресурс", summary: null, href: "/resources/published", image: null, priceFrom: null, attributes: {} }],
      page: 1, totalPages: scenario === "listing-empty" ? 0 : 1, totalItems: scenario === "listing-empty" ? 0 : 1,
      appliedFilters: {}, sortId: null,
      canonicalPath: scenario === "listing-wrong-path" ? "/wrong-path" : url.searchParams.get("path"),
      robots: "noindex_follow", releaseId: scenario === "listing-mixed" ? nextReleaseId : releaseId, asOf,
    })
  }
  return send({ code: "NOT_FOUND" }, 404)
}).listen(4398, "127.0.0.1")
