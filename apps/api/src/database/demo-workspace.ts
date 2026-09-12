import { createHash } from "node:crypto"
import { DataSource, IsNull, type EntityManager } from "typeorm"
import * as C from "@crm/contracts"
import { BusinessCalendarEntity, CatalogOfferingEntity, ChangeLogEntity, CmsSourceLinkEntity, ResourceGroupEntity, ResourceGroupMemberEntity, UserEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"
import { CustomersService } from "../customers/customers.service.js"
import { LeadsService } from "../leads/leads.service.js"
import { ResourcesService } from "../resources/resources.service.js"
import { ProgramsService } from "../programs/programs.service.js"
import { ProgramCategoriesService } from "../programs/program-categories.service.js"
import { EventsService } from "../events/events.service.js"
import { EventCategoriesService } from "../events/event-categories.service.js"
import { BookingsService } from "../bookings/bookings.service.js"
import { PaymentsService } from "../payments/payments.service.js"
import { TasksService } from "../tasks/tasks.service.js"
import { MarketingService } from "../marketing/marketing.service.js"
import { OfferingEditorApplicationService } from "../offerings/offering-editor-application.service.js"
import { ProgramOfferingApplicationService } from "../offerings/program-offering-application.service.js"
import { EventServiceApplicationService } from "../offerings/event-service-application.service.js"
import { OperationalQuoteAcceptanceService } from "../offerings/operational-quote-acceptance.service.js"

export const DEMO_NAMESPACE = "DEMO-WS1"
export function demoId(key: string): string {
  const hex = createHash("sha256").update(`${DEMO_NAMESPACE}:${key}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
const markerId = demoId("completion")
export const DEMO_PLAN = { customers: 4, leads: 6, resources: 5, resourceGroups: 1, offerings: 8, programTemplates: 2, occurrences: 3, registrations: 3, events: 2, bookings: 3, payments: 2, promotions: 2, tasks: 4, priceBooks: 8, newLoginAccounts: 0, automaticPublications: 0 }

export function assertDemoEnvironment(environment: NodeJS.ProcessEnv) {
  if (environment.APP_ENV !== "development" || environment.NODE_ENV === "production") throw new Error("seed:demo requires explicit APP_ENV=development and a nonproduction runtime")
  let url: URL
  try { url = new URL(environment.DATABASE_URL ?? "") } catch { throw new Error("seed:demo requires a PostgreSQL DATABASE_URL") }
  const database = decodeURIComponent(url.pathname.slice(1))
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.search || !/^[a-zA-Z0-9_]+$/.test(database) || /prod|live/i.test(database)) throw new Error("seed:demo accepts only an explicit local nonproduction database without connection overrides")
  return { database, host: url.hostname }
}

export async function demoPreflight(dataSource: DataSource, environment: NodeJS.ProcessEnv) {
  const expected = assertDemoEnvironment(environment)
  const [connected] = await dataSource.query('SELECT current_database() AS database, inet_server_addr()::text AS address') as Array<{ database: string; address: string | null }>
  const address = connected?.address?.split("/")[0] ?? ""
  // Local Docker port forwarding reports its private bridge address.
  const localAddress = address === "127.0.0.1" || address === "::1" || /^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  if (!connected || connected.database !== expected.database || !localAddress) throw new Error("Connected database does not match the validated local target")
  if (dataSource.options.synchronize || dataSource.options.migrationsRun || await dataSource.showMigrations()) throw new Error("Schema must already match migrations; seed:demo never migrates or synchronizes")
  const actor = await dataSource.getRepository(UserEntity).findOne({ where: { role: "admin", status: "active", archivedAt: IsNull() }, order: { id: "ASC" } })
  if (!actor) throw new Error("An existing active administrator is required; seed:demo never creates login accounts")
  const calendars = await dataSource.getRepository(BusinessCalendarEntity).find({ where: { state: "active", archivedAt: IsNull() } })
  if (calendars.length !== 1) throw new Error("Exactly one existing active business calendar is required; it will remain unchanged")
  return { ...expected, address, actor, calendar: calendars[0]! }
}

/** Seed-local adapter: service transactions become savepoints on the caller's connection. */
function withinTransaction(dataSource: DataSource, manager: EntityManager): DataSource {
  return new Proxy(dataSource, {
    get(target, property) {
      if (property === "manager") return manager
      if (property === "transaction") return manager.transaction.bind(manager)
      if (property === "getRepository") return manager.getRepository.bind(manager)
      if (property === "query") return manager.query.bind(manager)
      if (["initialize", "destroy", "createQueryRunner", "runMigrations", "synchronize"].includes(String(property))) return () => { throw new Error(`Seed service cannot use DataSource.${String(property)}`) }
      const value: unknown = Reflect.get(target, property)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}

export interface DemoWorkspaceReport { namespace: string; anchorDate: string; counts: Record<string, number>; ids: Record<string, string[]> }
export async function seedDemoWorkspace(dataSource: DataSource, environment: NodeJS.ProcessEnv, options: { now?: Date; rehearse?: boolean } = {}) {
  const preflight = await demoPreflight(dataSource, environment)
  let rehearsal: DemoWorkspaceReport | undefined
  const rollback = new Error("DEMO_REHEARSAL_ROLLBACK")
  try {
    return await dataSource.transaction("SERIALIZABLE", async (manager) => {
      const [{ acquired }] = await manager.query("SELECT pg_try_advisory_xact_lock(196634, 1) AS acquired") as [{ acquired: boolean }]
      if (!acquired) throw new Error("Another demo seed is running; retry after it completes")
      const marker = await manager.findOneBy(ChangeLogEntity, { id: markerId })
      if (marker) {
        if (marker.entityType !== "demo_workspace" || marker.changes.namespace !== DEMO_NAMESPACE) throw new Error("Demo marker identity is occupied")
        return { status: "unchanged" as const, report: marker.changes as unknown as DemoWorkspaceReport }
      }
      const report = await createScenario(withinTransaction(dataSource, manager), preflight.actor, preflight.calendar, options.now ?? new Date())
      await manager.insert(ChangeLogEntity, { id: markerId, entityType: "demo_workspace", entityId: markerId, action: "seeded", actorId: preflight.actor.id, requestId: DEMO_NAMESPACE, changes: { ...report }, createdAt: new Date() })
      if (options.rehearse) { rehearsal = report; throw rollback }
      return { status: "created" as const, report }
    })
  } catch (error) {
    if (error === rollback && rehearsal) return { status: "rehearsed" as const, report: rehearsal }
    throw error
  }
}

async function createScenario(ds: DataSource, user: UserEntity, calendar: BusinessCalendarEntity, now: Date): Promise<DemoWorkspaceReport> {
  const actor: C.SessionUser = { id: user.id, name: user.displayName, role: "admin", capabilities: roleCapabilities("admin") }
  const context = { actor, requestId: DEMO_NAMESPACE, entrySurface: "internal" as const }
  const operation = (key: string) => ({ operationId: demoId(key), idempotencyKey: `${DEMO_NAMESPACE}.${key}.v1` })
  const day = (offset: number, hour = 10) => { const value = new Date(now); value.setUTCDate(value.getUTCDate() + offset); value.setUTCHours(hour, 0, 0, 0); return value.toISOString() }
  const money = (amountMinor: number) => ({ amountMinor, currency: "RUB" })
  const assignees = [{ id: actor.id, name: actor.name, initials: actor.name.slice(0, 1) }]
  const ids: Record<string, string[]> = {}
  const keep = <T extends { id: string }>(group: string, value: T) => { (ids[group] ??= []).push(value.id); return value }
  const customers = new CustomersService(ds), leads = new LeadsService(ds), resources = new ResourcesService(ds)
  const marketing = new MarketingService(ds), quoteAcceptance = new OperationalQuoteAcceptanceService()
  const bookings = new BookingsService(ds, quoteAcceptance, marketing), payments = new PaymentsService(ds)
  const programs = new ProgramsService(ds, quoteAcceptance), events = new EventsService(ds, quoteAcceptance)
  const offerings = new OfferingEditorApplicationService(ds)
  const clients = []
  for (const [index, name] of ["Семья Соколовых", "Компания Пример", "Организатор праздника", "Гость кемпинга"].entries()) {
    clients.push(keep("customers", await customers.create(C.CustomerCreateSchema.parse({ name: `${DEMO_NAMESPACE} · ${name}`, type: index === 1 ? "company" : "person", email: `demo-ws1-${index + 1}@example.invalid`, notes: "Синтетические данные для локальной проверки CRM. Не связываться.", phones: [], channels: [], assignees }), actor, DEMO_NAMESPACE)))
  }
  const leadRows = []
  for (const [index, status] of ["new", "in_progress", "waiting", "success", "rejected", "new"].entries()) {
    const customer = clients[index % clients.length]!
    leadRows.push(keep("leads", await leads.create(C.LeadCreateSchema.parse({ customerId: customer.id, name: customer.name, status, direction: index % 2 ? "Мероприятия" : "Проживание", requestedItem: `${DEMO_NAMESPACE} · Подбор отдыха`, source: DEMO_NAMESPACE, channel: "demo", guestCount: index + 2, desiredStartAt: day(7 + index), desiredEndAt: day(9 + index), nextContactAt: day(index % 3), assignees, comment: "Синтетическая заявка. Внешние сообщения запрещены.", utm: { utm_source: index % 2 ? "demo_vk" : "demo_search", utm_medium: "demo", utm_campaign: "demo_workspace" } }), actor, DEMO_NAMESPACE)))
  }
  const resourceRows = []
  for (const item of [
    { suffix: "HOUSE", kind: "house", name: "Дом у озера", capacityMode: "fixed", capacityTotal: 6 },
    { suffix: "TENT", kind: "campground_owned_tent", name: "Готовая палатка", capacityMode: "fixed", capacityTotal: 4 },
    { suffix: "PITCH", kind: "campground_own_tent_area", name: "Места для палаток", capacityMode: "shared", capacityTotal: 10 },
    { suffix: "BATH", kind: "bath", name: "Баня Кедр", capacityMode: "fixed", capacityTotal: 6 },
    { suffix: "VENUE", kind: "venue", name: "Поляна для праздника", capacityMode: "fixed", capacityTotal: 40 },
  ]) resourceRows.push(keep("resources", await resources.create(C.ResourceCreateSchema.parse({ code: `${DEMO_NAMESPACE}-${item.suffix}`, kind: item.kind, name: `${DEMO_NAMESPACE} · ${item.name}`, capacityMode: item.capacityMode, capacityTotal: item.capacityTotal, settings: { active: true, demoNamespace: DEMO_NAMESPACE, description: item.kind === "bath" ? "Демо: public scheduled_resource ещё не поддерживается." : "Синтетический ресурс локальной CRM.", ...(item.kind === "venue" ? { spaceType: "outdoor" } : {}) } }), actor, DEMO_NAMESPACE)))
  const attribution = { createdBy: actor.id, updatedBy: actor.id, archivedAt: null }
  const group = keep("resourceGroups", await ds.manager.save(ds.manager.create(ResourceGroupEntity, { id: demoId("campgroup"), code: `${DEMO_NAMESPACE}-CAMP`, name: `${DEMO_NAMESPACE} · Кемпинг`, kind: "campground", state: "active", ...attribution })))
  for (const [index, role] of ["owned_tent", "own_tent_area"].entries()) await ds.manager.insert(ResourceGroupMemberEntity, { id: demoId(`campmember-${index}`), groupId: group.id, resourceId: resourceRows[index + 1]!.id, role, sortOrder: index, ...attribution })
  for (const index of [0, 1, 2, 4]) {
    const resource = resourceRows[index]!
    const result = index === 4 ? await offerings.createVenueOfferingFromResource(resource.id, operation(`offering-${index}`), context) : await offerings.createStayOfferingFromResource(resource.id, operation(`offering-${index}`), context)
    ;(ids.offerings ??= []).push(result.offeringId)
  }
  for (const [index, categoryKey] of ["comfort", "catering"].entries()) {
    const result = await offerings.createAddOn(C.AddOnOfferingCreateBodySchema.parse({ ...operation(`addon-${index}`), code: `${DEMO_NAMESPACE}-ADDON-${index + 1}`, operationalName: `${DEMO_NAMESPACE} · ${index ? "Пикник-сет" : "Комплект для отдыха"}`, internalComment: "Синтетическое дополнение", businessCalendarId: calendar.id, timezone: calendar.timezone, standalone: true, terms: { serviceType: "quantity_service", categoryKey, applicableOfferingKinds: ["house", "campground", "venue"], quantity: { metric: "units", min: 1, max: 10, default: 1, step: 1 } } }), context)
    ;(ids.offerings ??= []).push(result.offering.id)
  }
  const programCategory = keep("programCategories", await new ProgramCategoriesService(ds).create(C.ProgramCategoryCreateSchema.parse({ name: `${DEMO_NAMESPACE} · Семейные программы`, description: "Демо-категория", icon: "sparkles", tone: "sky", ...operation("program-category") }), actor, DEMO_NAMESPACE))
  const templateRows = []
  for (let index = 0; index < 2; index++) templateRows.push(keep("programTemplates", C.ProgramTemplateDtoSchema.parse(await programs.createTemplate(C.ProgramTemplateCreateSchema.parse({ ...operation(`template-${index}`), code: `${DEMO_NAMESPACE}-PROGRAM-${index + 1}`, name: `${DEMO_NAMESPACE} · ${index ? "Чайный мастер-класс" : "Лесной квест"}`, categoryId: programCategory.id, durationMinutes: 120, participantLimit: 16, minimumParticipants: 2, basePrice: money(150000), description: "Синтетическая программа для проверки сценариев", publication: "draft", assigneeIds: [actor.id] }), actor, DEMO_NAMESPACE))))
  const prepared = await new ProgramOfferingApplicationService(ds).prepare(templateRows[0]!.id, { ...operation("program-offering"), expectedProgramTemplateVersion: templateRows[0]!.version }, context)
  ;(ids.offerings ??= []).push(prepared.offeringId)
  for (let index = 0; index < 3; index++) {
    const occurrence = keep("occurrences", C.ProgramOccurrenceDtoSchema.parse(await programs.createOccurrence(C.ProgramOccurrenceCreateSchema.parse({ ...operation(`occurrence-${index}`), code: `${DEMO_NAMESPACE}-RUN-${index + 1}`, templateId: templateRows[index === 2 ? 1 : 0]!.id, startsAt: day(7 + index * 3, 10), endsAt: day(7 + index * 3, 12), participantLimit: 16, registrationLimit: 12, assigneeIds: [actor.id], comment: DEMO_NAMESPACE }), actor, DEMO_NAMESPACE)))
    const opened = await programs.transitionOccurrence(occurrence.id, { ...operation(`open-${index}`), version: occurrence.version, status: "open" }, actor, DEMO_NAMESPACE)
    keep("registrations", C.ProgramRegistrationDtoSchema.parse(await programs.createRegistration(C.ProgramRegistrationCreateSchema.parse({ ...operation(`registration-${index}`), code: `${DEMO_NAMESPACE}-REG-${index + 1}`, occurrenceId: opened.id, customerId: clients[index]!.id, participantCount: 2, participantNames: "Демо-гость А, Демо-гость Б", source: DEMO_NAMESPACE, ...(index === 2 ? { total: money(300000), status: "confirmed" } : {}), comment: index === 2 ? "Legacy manual demo registration" : "Ожидает расчёта server quote; сумма не подтверждена" }), actor, DEMO_NAMESPACE)))
  }
  const eventCategory = keep("eventCategories", await new EventCategoriesService(ds).create(C.EventCategoryCreateSchema.parse({ ...operation("event-category"), name: `${DEMO_NAMESPACE} · Праздники`, description: "Синтетическая категория", icon: "cake", tone: "violet" }), actor, DEMO_NAMESPACE))
  const eventOffering = await new EventServiceApplicationService(ds).create(C.EventServiceTemplateCreateBodySchema.parse({ ...operation("event-service"), templateCode: `${DEMO_NAMESPACE}-SERVICE`, offeringCode: `${DEMO_NAMESPACE}-EVENT-SERVICE`, operationalName: `${DEMO_NAMESPACE} · Семейный праздник`, format: "birthday", businessCalendarId: calendar.id, timezone: calendar.timezone, defaultDurationMinutes: 240, minimumGuests: 8, maximumGuests: 40, salesMode: "request_only", priceDisplayMode: "request" }), context)
  ;(ids.offerings ??= []).push(eventOffering.offering.id)
  for (let index = 0; index < 2; index++) keep("events", C.EventDtoSchema.parse(await events.create(C.EventCreateSchema.parse({ ...operation(`event-${index}`), code: `${DEMO_NAMESPACE}-EVENT-${index + 1}`, name: `${DEMO_NAMESPACE} · ${index ? "Обсуждение корпоративного выезда" : "Семейный праздник"}`, customerId: clients[index + 1]!.id, categoryId: eventCategory.id, startsAt: day(18 + index, 10), endsAt: day(18 + index, 14), guestCount: 20, total: money(index ? 0 : 1800000), status: index ? "inquiry" : "planning", comment: "Частный синтетический заказ; не публиковать как афишу", assigneeIds: [actor.id] }), actor, DEMO_NAMESPACE)))
  for (let index = 0; index < 3; index++) {
    let booking = await bookings.create(C.BookingCreateSchema.parse({ ...operation(`booking-${index}`), customerId: clients[index]!.id, note: `${DEMO_NAMESPACE} · ${index + 1}. Синтетическая бронь`, assignees, items: [{ type: index === 0 ? "bath" : "accommodation", resourceId: resourceRows[index === 0 ? 3 : 0]!.id, startAt: day(3 + index * 3, 10), endAt: day(index === 0 ? 3 : 4 + index * 3, index === 0 ? 12 : 10), quantity: 1, price: money(index === 0 ? 400000 : 800000), discount: money(0), preparationMinutes: 0 }] }), actor, DEMO_NAMESPACE)
    booking = await bookings.transition(booking.id, { ...operation(`booking-transition-${index}`), expectedVersion: booking.version, status: "unconfirmed" }, actor, DEMO_NAMESPACE)
    if (index === 0) booking = await bookings.transition(booking.id, { ...operation("booking-confirm"), expectedVersion: booking.version, status: "confirmed" }, actor, DEMO_NAMESPACE)
    keep("bookings", booking)
    if (index === 0) keep("payments", await payments.operate(C.PaymentOperationSchema.parse({ ...operation("booking-payment"), expectedVersion: booking.version, target: { type: "booking", id: booking.id }, type: "charge", amount: money(200000), method: "cash", reason: `${DEMO_NAMESPACE} · Синтетическая кассовая предоплата` }), actor, DEMO_NAMESPACE))
  }
  const privateEvent = await events.get(ids.events![0]!, actor)
  keep("payments", await payments.operate(C.PaymentOperationSchema.parse({ ...operation("event-payment"), expectedVersion: privateEvent.version, target: { type: "event", id: privateEvent.id }, type: "charge", amount: money(500000), method: "cash", reason: `${DEMO_NAMESPACE} · Синтетическая предоплата события` }), actor, DEMO_NAMESPACE))
  for (let index = 0; index < 2; index++) keep("promotions", await marketing.createPromotion(C.PromotionMutationSchema.parse({ ...operation(`promotion-${index}`), terms: { code: `${DEMO_NAMESPACE}-${index ? "FIXED" : "FAMILY"}`, name: `${DEMO_NAMESPACE} · ${index ? "Скидка 500 рублей" : "Семейная скидка"}`, active: index === 0, discountType: index ? "fixed" : "percent", value: index ? 50000 : 10, minimumAmountMinor: 100000, startsAt: day(0, 0), endsAt: day(60, 23), scope: "selected", resourceIds: [resourceRows[0]!.id], offeringIds: [] } }), actor, DEMO_NAMESPACE))
  for (let index = 0; index < 4; index++) keep("tasks", await new TasksService(ds).create(C.TaskCreateSchema.parse({ title: `${DEMO_NAMESPACE} · ${["Уточнить заезд", "Подготовить площадку", "Проверить оплату", "Согласовать программу"][index]}`, details: "Синтетическая задача для проверки связей", dueAt: day(index), priority: index === 0 ? "high" : "normal", assignees, relatedEntity: { type: "customer", id: clients[index]!.id } }), actor, DEMO_NAMESPACE))
  for (const [index, offeringId] of ids.offerings!.entries()) {
    const offering = await ds.manager.findOneByOrFail(CatalogOfferingEntity, { id: offeringId })
    const pricingBasis = offering.kind === "program" ? "per_person" : offering.kind === "addon" ? "per_unit" : offering.kind === "venue" ? "per_hour" : offering.kind === "event_service" ? "flat_package" : "per_night"
    const quantityMetric = offering.kind === "program" ? "participants" : offering.kind === "addon" || index === 2 ? "units" : offering.kind === "venue" || offering.kind === "event_service" ? "guests" : null
    const result = await offerings.createDraft(offeringId, C.HousePriceBookDraftCreateBodySchema.parse({ ...operation(`pricing-${index}`), expectedPricingVersion: offering.pricingVersion, name: `${DEMO_NAMESPACE} · Демо-тариф`, validFrom: day(0, 0).slice(0, 10), validToExclusive: day(60, 0).slice(0, 10), changeReason: "Демо-черновик. Активация требует проверки условий.", ratePlans: [{ key: "demo_standard", label: "Демо · Базовый", pricingBasis, quantityMetric, baseAmount: offering.kind === "house" ? 800000 : offering.kind === "program" ? 150000 : offering.kind === "event_service" ? 1800000 : 200000, includedQuantity: offering.kind === "venue" ? 40 : offering.kind === "event_service" ? 20 : null, baseExtraUnitAmount: offering.kind === "venue" ? 0 : offering.kind === "event_service" ? 50000 : null, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0 }] }), context)
    keep("priceBooks", result.priceBook)
  }
  const links = await ds.manager.find(CmsSourceLinkEntity, { where: ids.offerings!.map((sourceId) => ({ sourceKind: "catalog_offering", sourceId })) })
  ids.cmsDrafts = links.map((link) => link.nodeId)
  const sourceGroups: Array<[C.CmsSourceKind, string]> = [["resource", "resources"], ["catalog_offering", "offerings"], ["program_template", "programTemplates"], ["program_occurrence", "occurrences"], ["program_category", "programCategories"], ["event_category", "eventCategories"]]
  const sourceLinks = await ds.manager.find(CmsSourceLinkEntity, { where: sourceGroups.flatMap(([sourceKind, group]) => ids[group]!.map((sourceId) => ({ sourceKind, sourceId }))) })
  ids.cmsSourceNodes = [...new Set(sourceLinks.map((link) => link.nodeId))]
  return { namespace: DEMO_NAMESPACE, anchorDate: now.toISOString(), ids, counts: Object.fromEntries(Object.entries(ids).map(([key, values]) => [key, values.length])) }
}
