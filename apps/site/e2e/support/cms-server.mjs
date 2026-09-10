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
  if (url.pathname.endsWith("/offerings/houses/detail")) {
    if (scenario === "house-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "house-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const path = url.searchParams.get("path")
    const house = {
      offeringId: id,
      kind: "house",
      path,
      releaseId,
      title: "Домик из CMS",
      summary: "Операционные факты домика из safe public projection.",
      price: { mode: "from", amount: { amountMinor: 650000, currency: "RUB" } },
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
    if (scenario === "house-private") house.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "house-invalid") delete house.fulfillment
    if (scenario === "house-version") {
      house.releaseId = nextReleaseId
      house.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "house-wrong-path") house.path = "/houses/other"
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
    if (scenario === "campground-private") campground.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "campground-invalid") delete campground.fulfillment
    if (scenario === "campground-version") {
      campground.releaseId = nextReleaseId
      campground.sourceVersions.contentReleaseId = nextReleaseId
    }
    if (scenario === "campground-wrong-path") campground.path = "/campgrounds/other"
    return send(campground)
  }
  if (url.pathname.endsWith(`/offerings/venues/${id}`)) {
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
    if (scenario === "venue-private") venue.internalNotes = "PRIVATE_BACKEND_DETAIL"
    if (scenario === "venue-invalid") delete venue.fulfillment
    if (scenario === "venue-version") venue.sourceVersions.contentReleaseId = nextReleaseId
    if (scenario === "venue-wrong-id") venue.offeringId = nextReleaseId
    return send(venue)
  }
  if (url.pathname.endsWith(`/offerings/programs/${id}`)) {
    if (scenario === "program-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "program-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const program = {
      offeringId: id,
      kind: "program",
      path: "/programs/rafting",
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
    return send(program)
  }
  if (url.pathname.endsWith(`/offerings/event-services/${id}`)) {
    if (scenario === "event-service-missing") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "event-service-outage") return send({ code: "UNAVAILABLE", message: "PRIVATE_BACKEND_DETAIL" }, 503)
    const eventService = {
      offeringId: id,
      kind: "event_service",
      path: "/events/corporate",
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
  if (url.pathname.endsWith(`/offerings/addons/${id}`)) {
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
    return send(addon)
  }
  if (url.pathname.endsWith("/pages/resolve")) {
    if (scenario === "not-found") return send({ code: "NOT_FOUND" }, 404)
    if (scenario === "proxy-not-found") return send({ message: "proxy route missing" }, 404)
    if (scenario === "invalid") return send({ title: "PRIVATE_DRAFT_CONTENT" })
    if (scenario === "invalid-json") { response.writeHead(200); return response.end("<html>upstream error</html>") }
    const path = url.searchParams.get("path")
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
      reviews: { eyebrow: "CMS доверие", title: "Отзывы из CMS", description: "Редакционный текст отзывов из опубликованной редакции.", action: null },
      map: { eyebrow: "CMS схема", title: "Карта из CMS", description: "Редакционный текст карты из опубликованной редакции.", action: null },
      faq: { eyebrow: "CMS полезное", title: "FAQ из CMS", description: "Редакционный текст FAQ из опубликованной редакции.", action: null },
      calculator: { eyebrow: "CMS расчёт", title: "Калькулятор из CMS", description: "Редакционный текст калькулятора из опубликованной редакции.", action: null },
      footer: { eyebrow: null, title: "Footer из CMS", description: "", action: null },
    }
    if (scenario === "homepage-long") homepageConfigs.events.title = "События из CMS с очень длинным заголовком, который должен оставаться внутри viewport на мобильном экране"
    if (scenario === "homepage-empty") homepageConfigs.events.title = " "
    if (scenario === "homepage-private") homepageConfigs.events.internalNotes = "PRIVATE_BACKEND_DETAIL"
    const homepageEntries = Object.entries(homepageConfigs)
    if (scenario === "homepage-duplicate") homepageEntries.push(["events", homepageConfigs.events])
    return send({
      nodeId: id, revisionId: id, releaseId,
      kind: path === "/" ? "home" : path === "/addons/firewood" && scenario.startsWith("addon-") ? "addon_detail" : path === "/programs/rafting" && scenario.startsWith("program-") ? "program_detail" : path === "/events/corporate" && scenario.startsWith("event-service-") ? "event_detail" : (path === "/houses/forest" || path === "/campgrounds/pitches" || path === "/venues/meadow") && (scenario.startsWith("house-") || scenario.startsWith("campground-") || scenario.startsWith("venue-")) ? "resource_detail" : "resource_listing",
      path: scenario === "wrong-path" ? "/wrong-path" : path,
      title: path === "/houses/forest" && scenario.startsWith("house-") ? "Домик из CMS" : path === "/campgrounds/pitches" && scenario.startsWith("campground-") ? "Кемпинг из CMS" : path === "/venues/meadow" && scenario.startsWith("venue-") ? "Площадка из CMS" : path === "/programs/rafting" && scenario.startsWith("program-") ? "Программа из CMS" : path === "/events/corporate" && scenario.startsWith("event-service-") ? "Мероприятие из CMS" : path === "/addons/firewood" && scenario.startsWith("addon-") ? "Дополнение из CMS" : "Опубликованный заголовок", summary: path === "/houses/forest" && scenario.startsWith("house-") ? "Операционные факты домика из safe public projection." : path === "/campgrounds/pitches" && scenario.startsWith("campground-") ? "Операционные факты кемпинга из safe public projection." : path === "/venues/meadow" && scenario.startsWith("venue-") ? "Операционные факты площадки из safe public projection." : path === "/programs/rafting" && scenario.startsWith("program-") ? "Операционные факты программы из safe public projection." : path === "/events/corporate" && scenario.startsWith("event-service-") ? "Редакционное описание формата из safe public projection." : path === "/addons/firewood" && scenario.startsWith("addon-") ? "Операционные факты услуги из safe public projection." : "Описание опубликованной страницы", hero: null,
      sections: scenario.startsWith("listing") ? [{
        id, key: "catalog", renderer: "listing", rendererVersion: "1", schemaVersion: 1,
        order: 10, config: { definition },
      }] : scenario.startsWith("homepage-") ? homepageEntries.map(([key, config], index) => ({
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
      dependencies: path === "/addons/firewood" && scenario.startsWith("addon-") && scenario !== "addon-no-dependency" ? [{ type: "crm_projection", id, version: "public.addon-summary.v1", contentHash: "b".repeat(64) }] : path === "/venues/meadow" && scenario.startsWith("venue-") && scenario !== "venue-no-dependency" ? [{ type: "crm_projection", id, version: "public.venue-summary.v1", contentHash: "b".repeat(64) }] : path === "/programs/rafting" && scenario.startsWith("program-") && scenario !== "program-no-dependency" ? [{ type: "crm_projection", id, version: "public.program-summary.v1", contentHash: "b".repeat(64) }] : path === "/events/corporate" && scenario.startsWith("event-service-") && scenario !== "event-service-no-dependency" ? [{ type: "crm_projection", id, version: "public.event-service-summary.v1", contentHash: "b".repeat(64) }] : [], generatedAt: asOf,
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
