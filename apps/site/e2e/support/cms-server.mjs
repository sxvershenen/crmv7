import { createServer } from "node:http"
import { URL } from "node:url"

const id = "11111111-1111-4111-8111-111111111111"
const secondHouseId = "11111111-1111-4111-8111-111111111112"
const releaseId = "22222222-2222-4222-8222-222222222222"
const nextReleaseId = "33333333-3333-4333-8333-333333333333"
const asOf = "2026-09-10T10:00:00.000Z"
const definition = { id, entityKind: "resource", filters: [], sorts: [], defaultSortId: null, pageSize: 20 }
let scenario = "published"
let houseAmountMinor = 650000

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4398")
  const send = (body, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(JSON.stringify(body))
  }
  if (url.pathname === "/health") return send({ ok: true })
  if (url.pathname === "/__scenario" && request.method === "POST") {
    scenario = url.searchParams.get("name")
    houseAmountMinor = 650000
    return send({ scenario })
  }
  if (url.pathname === "/__house-price" && request.method === "POST") { houseAmountMinor = Number(url.searchParams.get("amountMinor")); return send({ houseAmountMinor, releaseId }) }
  if (!url.pathname.startsWith("/api/public/v1/")) return send({ code: "NOT_FOUND" }, 404)
  if (scenario === "outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
  if (scenario === "timeout") return // Intentionally wait for the caller's abort.
  if (scenario === "disconnect") return request.socket.destroy()
  if (scenario === "redirect") {
    response.writeHead(302, { Location: "/health" })
    return response.end()
  }
  if (url.pathname.endsWith("/pages/manifest")) {
    const unpublishedHouse = scenario === "unpublished-house"
    return send({
      releaseId, generatedAt: asOf,
      routes: [
        { path: "/", lastModified: asOf, schemaTypes: ["WebSite"] },
        { path: "/catalog", lastModified: asOf, schemaTypes: ["CollectionPage"] },
        { path: "/domiki/forest", lastModified: asOf, schemaTypes: ["Service"] },
        ...(scenario === "commerce-curated" ? [{ path: "/domiki/second", lastModified: asOf, schemaTypes: ["Service"] }] : []),
        { path: "/kemping/pitches", lastModified: asOf, schemaTypes: ["Service"] },
        { path: "/dopy/firewood", lastModified: asOf, schemaTypes: ["Service"] },
        { path: "/poshadki/meadow", lastModified: asOf, schemaTypes: ["Service"] },
        { path: "/programmy/rafting", lastModified: asOf, schemaTypes: ["Service"] },
        { path: "/meropriyatiya/corporate", lastModified: asOf, schemaTypes: ["Service"] },
      ].filter((route) => !unpublishedHouse || route.path !== "/domiki/forest"),
      redirects: [
        { sourcePath: "/houses/forest", destinationPath: "/domiki/forest", statusCode: 301 },
        { sourcePath: "/campgrounds/pitches", destinationPath: "/kemping/pitches", statusCode: 301 },
        { sourcePath: "/addons/firewood", destinationPath: "/dopy/firewood", statusCode: 301 },
        { sourcePath: "/venues/meadow", destinationPath: "/poshadki/meadow", statusCode: 301 },
        { sourcePath: "/programs/rafting", destinationPath: "/programmy/rafting", statusCode: 301 },
        { sourcePath: "/events/corporate", destinationPath: "/meropriyatiya/corporate", statusCode: 301 },
      ].filter((redirect) => !unpublishedHouse || redirect.destinationPath !== "/domiki/forest"),
      cache: { etag: "test-routes", maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300, tags: [`cms-release:${releaseId}`] },
    })
  }
  if (url.pathname.endsWith("/site-settings")) {
    if (scenario === "settings-missing") return send({ code: "NOT_FOUND" }, 404)
    return send({
      releaseId: scenario === "mixed-settings" ? nextReleaseId : releaseId,
      revisionId: id, contentVersion: "a".repeat(64), publishedAt: asOf,
      value: {
        siteName: "Тестовый опубликованный сайт",
        headerNavigation: scenario === "homepage-navigation-managed" ? [{ id, label: "Раздел из CMS", link: { kind: "internal", path: "/cms-test" }, children: [
          { id: "11111111-1111-4111-8111-111111111112", label: "Видимая ссылка", link: { kind: "internal", path: "/cms-test" } },
          { id: "11111111-1111-4111-8111-111111111113", label: "Скрытая ссылка", link: { kind: "internal", path: "/cms-test" }, enabled: false },
          { id: "11111111-1111-4111-8111-111111111114", label: "Только телефон", link: { kind: "internal", path: "/cms-test" }, visibleOn: "mobile" },
          { id: "11111111-1111-4111-8111-111111111115", label: "Группа", link: { kind: "internal", path: "/cms-test" }, children: [
            { id: "11111111-1111-4111-8111-111111111116", label: "Скрытый третий уровень", link: { kind: "internal", path: "/cms-test" }, enabled: false },
            { id: "11111111-1111-4111-8111-111111111117", label: "Доступный третий уровень", link: { kind: "internal", path: "/cms-test" } },
          ] },
        ] }] : [{ id, label: "Раздел из CMS", link: { kind: "internal", path: "/cms-test" } }],
        ...(scenario === "homepage-navigation-managed" ? { footerNavigation: [] } : scenario === "homepage-footer-nested" ? { footerNavigation: Array.from({ length: 4 }, (_, index) => ({
          id: `11111111-1111-4111-8111-${String(index + 20).padStart(12, "0")}`,
          label: `Раздел подвала ${index + 1}`,
          link: { kind: "internal", path: "/" },
          children: index === 3 ? [{ id: "11111111-1111-4111-8111-111111111130", label: "Вложенный пункт", link: { kind: "internal", path: "/privacy" }, children: [
            { id: "11111111-1111-4111-8111-111111111131", label: "Глубокая ссылка", link: { kind: "internal", path: "/privacy" } },
          ] }] : [],
        })) } : {}),
        heroDefault: { title: "Глобальный hero не должен воскреснуть" },
        analytics: { metrika: { enabled: true, counterId: "12345678" } },
      },
    })
  }
  if (url.pathname.endsWith("/offerings/houses/detail") || url.pathname.endsWith("/offerings/houses")) {
    const isList = url.pathname.endsWith("/offerings/houses")
    if (isList && scenario === "commerce-outage") return send({ code: "UNAVAILABLE" }, 503)
    if (scenario === "house-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "house-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const path = url.searchParams.get("path") ?? "/domiki/forest"
    const house = {
      offeringId: id,
      kind: "house",
      path,
      releaseId,
      title: "Домик из CMS",
      summary: "Операционные факты домика из safe public projection.",
      price: { mode: "from", amount: { amountMinor: houseAmountMinor, currency: "RUB" } },
      priceBasisLabel: "за ночь",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      fulfillment: { allocationMode: "exclusive_resource", capacityUnit: "guests", capacityTotal: 4, pricingMode: "rate_plan", spaceType: "mixed", availabilityMode: "resource" },
    }
    if (scenario === "house-empty") {
      house.price = { mode: "request" }
      house.priceBasisLabel = null
      house.readiness = "request_only"
      house.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "house-unavailable" || scenario === "house-archived") {
      house.requestAvailable = false
      house.readiness = scenario === "house-archived" ? "archived" : "temporarily_unavailable"
      house.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "house-private") house.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "house-invalid") delete house.fulfillment
    if (scenario === "house-version") {
      house.releaseId = nextReleaseId
      house.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "house-wrong-path") house.path = "/houses/other"
    if (isList) {
      if (scenario === "commerce-curated") {
        if (url.searchParams.has("cursor")) return send({ items: [{ ...house, offeringId: secondHouseId, path: "/domiki/second", title: "Второй домик из CMS" }], nextCursor: null, releaseId, asOf })
        return send({ items: [house], nextCursor: "second-house", releaseId, asOf })
      }
      if (scenario === "commerce-private") house.internalNotes = "PRIVATE_BACKEND_DETAIL"
      if (scenario === "commerce-mixed-item") house.sourceVersions.contentReleaseId = nextReleaseId
      if (scenario === "commerce-unavailable") { house.requestAvailable = false; house.readiness = "temporarily_unavailable" }
      if (scenario === "commerce-request") { house.price = { mode: "request" }; house.priceBasisLabel = null }
      return send({ items: scenario === "commerce-empty" ? [] : [house], nextCursor: null, releaseId: scenario === "commerce-mixed" ? nextReleaseId : releaseId, asOf })
    }
    return send(house)
  }
  if (url.pathname.endsWith("/offerings/campgrounds/detail")) {
    if (scenario === "campground-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "campground-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const path = url.searchParams.get("path")
    const campground = {
      offeringId: id,
      kind: "campground",
      path,
      releaseId,
      title: "Кемпинг из CMS",
      summary: "Операционные факты кемпинга из safe public projection.",
      price: { mode: "from", amount: { amountMinor: 180000, currency: "RUB" } },
      priceBasisLabel: "за ночь",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: { unit: "tent", available: 15 },
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      fulfillment: { salesUnit: "own_tent_pitch", allocationMode: "shared_capacity", capacityUnit: "tent", capacityTotal: 15, guestCapacityTotal: null, pricingMode: "rate_plan", availabilityMode: "resource" },
    }
    if (scenario === "campground-empty") {
      campground.price = { mode: "request" }
      campground.priceBasisLabel = null
      campground.readiness = "request_only"
      campground.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "campground-unavailable" || scenario === "campground-archived") {
      campground.requestAvailable = false
      campground.readiness = scenario === "campground-archived" ? "archived" : "temporarily_unavailable"
      campground.capacity.available = null
      campground.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "campground-private") campground.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "campground-invalid") delete campground.fulfillment
    if (scenario === "campground-version") {
      campground.releaseId = nextReleaseId
      campground.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "campground-wrong-path") campground.path = "/campgrounds/other"
    return send(campground)
  }
  if (url.pathname.endsWith(`/offerings/venues/${id}`) || url.pathname.endsWith("/offerings/venues")) {
    const isList = url.pathname.endsWith("/offerings/venues")
    if (isList && scenario === "commerce-outage") return send({ code: "UNAVAILABLE" }, 503)
    if (scenario === "venue-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "venue-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const venue = {
      offeringId: id,
      kind: "venue",
      title: "Площадка из CMS",
      summary: "Операционные факты площадки из safe public projection.",
      price: { mode: "from", amount: { amountMinor: 320000, currency: "RUB" } },
      priceBasisLabel: "за час",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      fulfillment: { allocationMode: "exclusive_resource", capacityUnit: "guests", capacityTotal: 40, pricingMode: "rate_plan", spaceType: "outdoor", availabilityMode: "resource" },
    }
    if (scenario === "venue-empty") {
      venue.price = { mode: "request" }
      venue.priceBasisLabel = null
      venue.readiness = "request_only"
      venue.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "venue-unavailable" || scenario === "venue-archived") {
      venue.requestAvailable = false
      venue.readiness = scenario === "venue-archived" ? "archived" : "temporarily_unavailable"
      venue.fulfillment.availabilityMode = "request_only"
    }
    if (scenario === "venue-private") venue.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "venue-invalid") delete venue.fulfillment
    if (scenario === "venue-version") venue.sourceVersions.contentReleaseId = nextReleaseId
    if (scenario === "venue-wrong-id") venue.offeringId = nextReleaseId
    if (isList) {
      if (scenario === "commerce-private") venue.internalNotes = "PRIVATE_BACKEND_DETAIL"
      if (scenario === "commerce-mixed-item") venue.sourceVersions.contentReleaseId = nextReleaseId
      if (scenario === "commerce-unavailable") { venue.requestAvailable = false; venue.readiness = "temporarily_unavailable" }
      if (scenario === "commerce-request") { venue.price = { mode: "request" }; venue.priceBasisLabel = null }
      return send({ items: scenario === "commerce-empty" ? [] : [venue], nextCursor: null, releaseId: scenario === "commerce-mixed" ? nextReleaseId : releaseId, asOf })
    }
    return send(venue)
  }
  if (url.pathname.endsWith(`/offerings/programs/${id}`) || url.pathname.endsWith("/offerings/programs")) {
    const isList = url.pathname.endsWith("/offerings/programs")
    if (isList && scenario === "commerce-outage") return send({ code: "UNAVAILABLE" }, 503)
    if (scenario === "program-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "program-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const program = {
      offeringId: id,
      kind: "program",
      path: "/programmy/rafting",
      releaseId,
      title: "Программа из CMS",
      summary: "Операционные факты программы из safe public projection.",
      price: { mode: "from", amount: { amountMinor: 250000, currency: "RUB" } },
      priceBasisLabel: "за участника",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      fulfillment: { durationMinutes: 180, minimumParticipants: 2, participantLimit: 20, availabilityMode: "occurrence", nextOccurrence: { startsAt: "2026-09-20T10:00:00.000Z", endsAt: "2026-09-20T13:00:00.000Z", participantLimit: 20, registrationLimit: 10 } },
    }
    if (scenario === "program-empty") {
      program.price = { mode: "request" }
      program.priceBasisLabel = null
      program.readiness = "request_only"
      program.fulfillment.availabilityMode = "request_only"
      program.fulfillment.nextOccurrence = null
    }
    if (scenario === "program-private") program.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "program-invalid") delete program.fulfillment
    if (scenario === "program-version") {
      program.releaseId = nextReleaseId
      program.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "program-wrong-path") program.path = "/programs/other"
    if (scenario === "program-wrong-id") program.offeringId = nextReleaseId
    if (isList) {
      if (scenario === "commerce-private") program.internalNotes = "PRIVATE_BACKEND_DETAIL"
      if (scenario === "commerce-mixed-item") program.sourceVersions.contentReleaseId = nextReleaseId
      if (scenario === "commerce-unavailable") { program.requestAvailable = false; program.readiness = "temporarily_unavailable" }
      if (scenario === "commerce-request") { program.price = { mode: "request" }; program.priceBasisLabel = null }
      return send({ items: scenario === "commerce-empty" ? [] : [program], nextCursor: null, releaseId: scenario === "commerce-mixed" ? nextReleaseId : releaseId, asOf })
    }
    return send(program)
  }
  if (url.pathname.endsWith(`/offerings/event-services/${id}`)) {
    if (scenario === "event-service-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "event-service-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const eventService = {
      offeringId: id,
      kind: "event_service",
      path: "/meropriyatiya/corporate",
      releaseId,
      title: "Мероприятие из CMS",
      summary: "Редакционное описание формата из safe public projection.",
      price: { mode: "request" },
      priceBasisLabel: null,
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "request_only",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: null, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      format: "corporate",
      fulfillment: { durationMinutes: 360, minimumGuests: 10, maximumGuests: 80, availabilityMode: "request_only" },
    }
    if (scenario === "event-service-private") eventService.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "event-service-invalid") delete eventService.fulfillment
    if (scenario === "event-service-version") {
      eventService.releaseId = nextReleaseId
      eventService.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "event-service-wrong-path") eventService.path = "/events/other"
    if (scenario === "event-service-wrong-id") eventService.offeringId = nextReleaseId
    return send(eventService)
  }
  if (url.pathname.endsWith(`/offerings/addons/${id}`) || url.pathname.endsWith("/offerings/addons")) {
    const isList = url.pathname.endsWith("/offerings/addons")
    if (isList && scenario === "commerce-outage") return send({ code: "UNAVAILABLE" }, 503)
    if (scenario === "addon-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "addon-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const addon = {
      offeringId: id,
      kind: "addon",
      title: "Дополнение из CMS",
      summary: "Операционные факты услуги из safe public projection.",
      price: { mode: "from", amount: { amountMinor: 120000, currency: "RUB" } },
      priceBasisLabel: "за единицу",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "ready",
      timezone: "Europe/Moscow",
      currency: "RUB",
      sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: releaseId, profileRevisionId: id },
      asOf,
      terms: { serviceType: "quantity_service", standalone: true, categoryKey: "comfort", quantity: { unit: "unit", minimum: 1, maximum: 10, default: 1, step: 1 } },
    }
    if (scenario === "addon-empty") {
      addon.price = { mode: "request" }
      addon.priceBasisLabel = null
      addon.readiness = "request_only"
    }
    if (scenario === "addon-private") addon.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "addon-invalid") delete addon.terms
    if (scenario === "addon-version") addon.sourceVersions.contentReleaseId = nextReleaseId
    if (scenario === "addon-wrong-id") addon.offeringId = nextReleaseId
    if (isList) {
      if (scenario === "commerce-private") addon.internalNotes = "PRIVATE_BACKEND_DETAIL"
      if (scenario === "commerce-mixed-item") addon.sourceVersions.contentReleaseId = nextReleaseId
      if (scenario === "commerce-unavailable") { addon.requestAvailable = false; addon.readiness = "temporarily_unavailable" }
      if (scenario === "commerce-request") { addon.price = { mode: "request" }; addon.priceBasisLabel = null }
      return send({ items: scenario === "commerce-empty" ? [] : [addon], nextCursor: null, releaseId: scenario === "commerce-mixed" ? nextReleaseId : releaseId, asOf })
    }
    return send(addon)
  }
  if (url.pathname.endsWith("/pages/preview")) {
    if (scenario !== "preview-draft" || url.searchParams.get("token") !== "p".repeat(40)) return send({ code: "NOT_FOUND" }, 404)
    return send({
      nodeId: id, revisionId: nextReleaseId, kind: "resource_detail", path: "/domiki/new",
      page: { kind: "resource_detail", path: "/domiki/new", title: "Новый черновик домика", summary: "Редакционное описание до настройки цены в CRM.", hero: null, sections: [],
        seo: { title: "Черновик домика", description: "Описание черновика", indexPolicy: "noindex_nofollow", canonical: { mode: "self" }, structuredData: [] } },
      renderable: true, blockingIssues: ["CMS_RESOURCE_PUBLIC_PROJECTION_REQUIRED"], generatedAt: asOf,
    })
  }
  if (url.pathname.endsWith("/pages/resolve")) {
    if (scenario === "not-found" || (scenario === "unpublished-house" && ["/domiki/forest", "/houses/forest"].includes(url.searchParams.get("path")))) return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "proxy-not-found") return send({ message: "proxy route missing" }, 404)
    if (scenario === "invalid") return send({ title: "PRIVATE_DRAFT_CONTENT" })
    if (scenario === "invalid-json") { response.writeHead(200); return response.end("<html>upstream error</html>") }
    const path = url.searchParams.get("path")
    if (scenario === "editorial" && (path === "/blog/guide" || path === "/privacy")) return send({
      nodeId: id, revisionId: id, releaseId, kind: path === "/privacy" ? "legal" : "article", path,
      title: path === "/privacy" ? "Политика конфиденциальности" : "Гид по отдыху", summary: "Опубликованный редакционный материал", hero: null,
      sections: [{ id, key: "body", renderer: "editorial-content", rendererVersion: "1", schemaVersion: 1, order: 10, config: { heading: null, lead: "Короткое введение", ...(path === "/privacy" ? {} : { authorName: "Марина Кириллова" }), blocks: [{ type: "heading", level: "h2", text: "Важно знать" }, { type: "paragraph", text: "Этот текст пришёл из active CMS release." }, { type: "list", items: ["Домики", "Программы"] }], links: [{ label: "На главную", href: "/" }] } }],
      seo: { title: path === "/privacy" ? "Политика" : "Гид по отдыху", description: "Описание из CMS", indexPolicy: path === "/privacy" ? "noindex_follow" : "index_follow", canonical: { mode: "self" }, structuredData: path === "/privacy" ? [] : [{ id, schemaType: "Article", enabled: true, payload: { headline: "Гид по отдыху", author: { "@type": "Person", name: "Марина Кириллова" }, datePublished: "2026-09-10" } }] },
      dependencies: [], generatedAt: asOf, cache: { etag: "editorial-page", maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300, tags: [] }, freshness: { contentVersion: "a".repeat(64), crmProjectionAsOf: null, ready: true },
    })
    const partnersConfig = {
      title: scenario === "partners-long" ? "Наши партнёры помогают сделать каждый семейный отдых особенным и запоминающимся" : "Наши опубликованные партнёры",
      description: "Совместные проекты из CMS", items: [{ id, label: "Пекарня из CMS" }, { id: nextReleaseId, label: "Кофейня из CMS" }],
    }
    if (scenario === "partners-empty") partnersConfig.items = []
    if (scenario === "partners-duplicate") partnersConfig.items[1].id = id
    if (scenario === "partners-private") partnersConfig.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "partners-blank") partnersConfig.title = " "
    const whyUsConfig = {
      eyebrow: "Доказательства из CMS", title: scenario === "why-us-long" ? "Почему гости выбирают нас снова и снова для отдыха и событий" : "Почему выбирают нас из CMS",
      description: "Опубликованное описание доверия", facts: [
        { id: "distance", number: "9 мин", title: "От нового места", description: "Тестовый факт из опубликованной редакции." },
        { id: "nature", number: "24 га", title: "Соснового леса", description: "Ещё один факт из CMS." },
      ], team: { label: "Команда из CMS", title: "Редакционный заголовок команды", description: "Описание команды из опубликованной редакции." },
    }
    if (scenario === "why-us-empty") whyUsConfig.facts = []
    if (scenario === "why-us-duplicate") whyUsConfig.facts[1].id = whyUsConfig.facts[0].id
    if (scenario === "why-us-private") whyUsConfig.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "why-us-blank") whyUsConfig.title = " "
    const homepageConfigs = {
      events: { eyebrow: "CMS афиша", title: "События из CMS", description: "Редакционный текст событий из опубликованной редакции.", action: null },
      houses: { eyebrow: "CMS глэмпинг", title: "Домики из CMS", description: "Редакционный текст домиков из опубликованной редакции.", action: null },
      "sauna-chan": { eyebrow: "CMS SPA", title: "Баня из CMS", description: "Редакционный текст бани из опубликованной редакции.", action: null },
      programs: { eyebrow: null, title: "Программы из CMS", description: "", action: null },
      venues: { eyebrow: null, title: "Площадки из CMS", description: "", action: null },
      blog: { eyebrow: null, title: "Материалы из CMS", description: "", action: { label: "Все материалы", href: "/blog" } },
      reviews: { reviews: [{ id: "review-2", name: "Второй гость из CMS", text: "Второй отзыв из релиза", rating: 4 }, { id: "review-1", name: "Первый гость из CMS", text: "Первый отзыв из релиза", rating: 5 }], eyebrow: "CMS доверие", title: "Отзывы из CMS", description: "Редакционный текст отзывов из опубликованной редакции.", action: null },
      map: { eyebrow: "CMS схема", title: "Карта из CMS", description: "Редакционный текст карты из опубликованной редакции.", action: null },
      faq: { faq: [{ id: "faq-2", question: "Второй вопрос из CMS?", answer: "Второй ответ из релиза" }, { id: "faq-1", question: "Первый вопрос из CMS?", answer: "Первый ответ из релиза" }], eyebrow: "CMS полезное", title: "FAQ из CMS", description: "Редакционный текст FAQ из опубликованной редакции.", action: null },
      calculator: { eyebrow: "CMS расчёт", title: "Калькулятор из CMS", description: "Редакционный текст калькулятора из опубликованной редакции.", action: null },
      footer: { eyebrow: null, title: "Footer из CMS", description: "", action: null },
    }
    if (scenario === "homepage-long") homepageConfigs.events.title = "События из CMS с очень длинным заголовком, который должен оставаться внутри viewport на мобильном экране"
    if (scenario === "homepage-empty") homepageConfigs.events.title = " "
    if (scenario === "homepage-private") homepageConfigs.events.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "details-empty") { homepageConfigs.reviews.reviews = []; homepageConfigs.faq.faq = [] }
    if (scenario === "details-absent") { delete homepageConfigs.reviews.reviews; delete homepageConfigs.faq.faq }
    if (scenario === "details-blank") homepageConfigs.faq.faq[0].answer = " "
    if (scenario === "details-rating") homepageConfigs.reviews.reviews[0].rating = 6
    if (scenario === "details-duplicate") homepageConfigs.reviews.reviews[1].id = homepageConfigs.reviews.reviews[0].id
    if (scenario === "details-private") homepageConfigs.reviews.reviews[0].email = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "commerce-curated") {
      homepageConfigs.houses.selectedOfferingIds = [secondHouseId, id]
      homepageConfigs.programs.selectedOfferingIds = []
      homepageConfigs.venues.selectedOfferingIds = []
    }
    const homepageEntries = Object.entries(homepageConfigs).filter(([key]) => scenario.startsWith("commerce-") ? ["events", "houses", "sauna-chan", "programs", "venues", "calculator"].includes(key) : !scenario.startsWith("details-") || ["reviews", "faq"].includes(key))
    if (scenario === "homepage-duplicate") homepageEntries.push(["events", homepageConfigs.events])
    return send({
      nodeId: id, revisionId: id, releaseId,
      kind: path === "/" ? "home" : path === "/dopy/firewood" && scenario.startsWith("addon-") ? "addon_detail" : path === "/programmy/rafting" && scenario.startsWith("program-") ? "program_detail" : path === "/meropriyatiya/corporate" && scenario.startsWith("event-service-") ? "event_detail" : (path === "/domiki/forest" || path === "/kemping/pitches" || path === "/poshadki/meadow") && (scenario.startsWith("house-") || scenario.startsWith("campground-") || scenario.startsWith("venue-")) ? "resource_detail" : "resource_listing",
      path: scenario === "wrong-path" ? "/wrong-path" : path,
      title: path === "/domiki/forest" && scenario.startsWith("house-") ? "Домик из CMS" : path === "/kemping/pitches" && scenario.startsWith("campground-") ? "Кемпинг из CMS" : path === "/poshadki/meadow" && scenario.startsWith("venue-") ? "Площадка из CMS" : path === "/programmy/rafting" && scenario.startsWith("program-") ? "Программа из CMS" : path === "/meropriyatiya/corporate" && scenario.startsWith("event-service-") ? "Мероприятие из CMS" : path === "/dopy/firewood" && scenario.startsWith("addon-") ? "Дополнение из CMS" : "Опубликованный заголовок", summary: path === "/domiki/forest" && scenario.startsWith("house-") ? "Операционные факты домика из safe public projection." : path === "/kemping/pitches" && scenario.startsWith("campground-") ? "Операционные факты кемпинга из safe public projection." : path === "/poshadki/meadow" && scenario.startsWith("venue-") ? "Операционные факты площадки из safe public projection." : path === "/programmy/rafting" && scenario.startsWith("program-") ? "Операционные факты программы из safe public projection." : path === "/meropriyatiya/corporate" && scenario.startsWith("event-service-") ? "Редакционное описание формата из safe public projection." : path === "/dopy/firewood" && scenario.startsWith("addon-") ? "Операционные факты услуги из safe public projection." : "Описание опубликованной страницы", hero: scenario === "commerce-hero" ? { title: "Опубликованный hero" } : null,
      sections: scenario.startsWith("listing") ? [{
        id, key: "catalog", renderer: "listing", rendererVersion: "1", schemaVersion: 1,
        order: 10, config: { definition },
      }] : (scenario.startsWith("homepage-") || scenario.startsWith("details-") || scenario.startsWith("commerce-")) ? homepageEntries.map(([key, config], index) => ({
        id: `${id.slice(0, -2)}${String(index + 10).padStart(2, "0")}`, key, renderer: scenario === "homepage-renderer" ? "unknown" : "homepage-section",
        rendererVersion: scenario === "homepage-version" ? "2" : "1", schemaVersion: 1, order: index * 10 + 10, config,
      })) : scenario.startsWith("partners-") ? [{
        id, key: "partners", renderer: scenario === "partners-renderer" ? "unknown" : "partners",
        rendererVersion: scenario === "partners-version" ? "2" : "1", schemaVersion: 1, order: 10, config: partnersConfig,
      }] : scenario.startsWith("why-us-") ? [{
        id, key: "why-us", renderer: scenario === "why-us-renderer" ? "unknown" : "why-us",
        rendererVersion: scenario === "why-us-version" ? "2" : "1", schemaVersion: 1, order: 10, config: whyUsConfig,
      }] : [],
      seo: { title: "SEO опубликованной страницы", description: "Описание из CMS", indexPolicy: "index_follow", canonical: { mode: "self" } },
      dependencies: path === "/dopy/firewood" && scenario.startsWith("addon-") && scenario !== "addon-no-dependency" ? [{ type: "crm_projection", id, version: "public.addon-summary.v1", contentHash: "b".repeat(64) }] : path === "/poshadki/meadow" && scenario.startsWith("venue-") && scenario !== "venue-no-dependency" ? [{ type: "crm_projection", id, version: "public.venue-summary.v1", contentHash: "b".repeat(64) }] : path === "/programmy/rafting" && scenario.startsWith("program-") && scenario !== "program-no-dependency" ? [{ type: "crm_projection", id, version: "public.program-summary.v1", contentHash: "b".repeat(64) }] : path === "/meropriyatiya/corporate" && scenario.startsWith("event-service-") && scenario !== "event-service-no-dependency" ? [{ type: "crm_projection", id, version: "public.event-service-summary.v1", contentHash: "b".repeat(64) }] : [], generatedAt: asOf,
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
