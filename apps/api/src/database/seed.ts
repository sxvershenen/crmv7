import "reflect-metadata"

import { randomUUID } from "node:crypto"

import {
  CustomerEntity,
  BookingEntity,
  BookingItemEntity,
  AddonOfferingTermsEntity,
  BusinessCalendarDateEntity,
  BusinessCalendarEntity,
  CampgroundOfferingTermsEntity,
  CatalogOfferingEntity,
  EventCategoryEntity,
  EventEntity,
  LeadEntity,
  OfferingBindingEntity,
  OfferingAddonAssignmentEntity,
  ProgramCategoryEntity,
  ProgramOccurrenceEntity,
  ProgramRegistrationEntity,
  ProgramTemplateEntity,
  PaymentEntity,
  PriceBookEntity,
  PriceRuleEntity,
  RatePlanEntity,
  ResourceAllocationEntity,
  ResourceEntity,
  ResourceGroupEntity,
  ResourceGroupMemberEntity,
  TaskEntity,
  UserEntity,
  WorkspaceSettingsEntity,
} from "@crm/db"
import crmDataSource from "@crm/db/data-source"
import type { EventCategoryCreate, ProgramCategoryCreate, TaskPriority } from "@crm/contracts"

import { hashPassword } from "../auth/password.js"
import { ensureCatalogOfferingEditorialDraft } from "../cms/cms-source-draft.js"
import { seedCmsDemoData } from "./cms-demo-seed.js"
import { seedMarketingDemoData } from "./marketing-demo-seed.js"

async function seed() {
  await crmDataSource.initialize()
  await crmDataSource.runMigrations()
  const users = crmDataSource.getRepository(UserEntity)
  let admin = await users.findOneBy({ email: "admin@svistoplyasovo.local" })
  if (!admin) {
    admin = users.create({
      id: randomUUID(), email: "admin@svistoplyasovo.local", displayName: "Администратор CRM",
      passwordHash: await hashPassword("change-me-in-local-env"), role: "admin", status: "active",
      createdBy: null, updatedBy: null, archivedAt: null,
    })
    admin = await users.save(admin)
  }

  const workspaceSettings = crmDataSource.getRepository(WorkspaceSettingsEntity)
  if (!await workspaceSettings.findOneBy({ id: "00000000-0000-4000-8000-000000000001" })) {
    await workspaceSettings.save(workspaceSettings.create({
      id: "00000000-0000-4000-8000-000000000001",
      organization: { currency: "RUB", email: "info@svistoplyasovo.ru", locale: "ru-RU", name: "Свистоплясово", phone: "+7 000 000-00-00", timezone: "Europe/Moscow" },
      operations: { autoAssignNewLeads: false, bookingPrefix: "B", conflictWarnings: true, defaultLeadSource: "Сайт", requireClientPhone: true },
      site: { connectionStatus: "planned", defaultAssigneeId: null, defaultSource: "Сайт", intakeEnabled: true, publishAggregatedAvailability: false, publishPrices: true, publishResources: true, siteUrl: "https://svistoplyasovo.ru" },
      integrations: [{ id: "site", name: "Публичный сайт", description: "Формы и опубликованные данные", status: "planned", lastSyncAt: null }, { id: "cms", name: "CMS и публикации", description: "Контент, SEO и медиа", status: "planned", lastSyncAt: null }, { id: "telephony", name: "Телефония", description: "Звонки и записи разговоров", status: "attention", lastSyncAt: null }, { id: "analytics", name: "Веб-аналитика", description: "UTM и атрибуция заявок", status: "connected", lastSyncAt: null }],
      staffConfiguration: {}, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  // Everything below is demonstration content. Never let a production seed
  // claim operational rows by their human-readable names or codes.
  if (process.env.APP_ENV === "production") {
    await crmDataSource.destroy()
    return
  }

  const customers = crmDataSource.getRepository(CustomerEntity)
  let customer = await customers.findOneBy({ name: "Илья Воронцов" })
  if (!customer) {
    customer = await customers.save(customers.create({
      id: randomUUID(), type: "person", name: "Илья Воронцов", phones: ["+79214501240"],
      channels: ["phone"], email: "ilya@example.local", notes: "Демонстрационный клиент локального окружения.",
      consent: { channel: "phone", version: "local-seed-v1" }, duplicateRisk: "none",
      assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }],
      leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 1,
      turnover: 0, debt: 0, nextContactAt: new Date("2026-09-01T07:00:00.000Z"), lastVisitAt: null,
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const leads = crmDataSource.getRepository(LeadEntity)
  if (!await leads.findOneBy({ name: "Илья Воронцов", source: "Локальный seed" })) {
    await leads.save(leads.create({
      id: randomUUID(), customerId: customer.id, name: customer.name, phone: customer.phones[0] ?? null,
      channel: "phone", direction: "Проживание", requestedItem: "Дом «Сосна»",
      desiredStartAt: new Date("2026-09-05T09:00:00.000Z"), desiredEndAt: new Date("2026-09-07T09:00:00.000Z"),
      guestCount: 4, comment: "Уточнить состав гостей и время заезда.", source: "Локальный seed",
      utm: { source: "direct" }, assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }],
      nextContactAt: new Date("2026-09-01T07:00:00.000Z"), status: "new",
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  const customerLeadCount = await leads.countBy({ customerId: customer.id })
  const customerActiveLeadCount = await leads.createQueryBuilder("lead")
    .where("lead.customer_id = :customerId", { customerId: customer.id })
    .andWhere("lead.archived_at IS NULL")
    .andWhere("lead.status NOT IN (:...terminal)", { terminal: ["success", "rejected", "spam", "archived"] })
    .getCount()
  if (customer.leadCount !== customerLeadCount || customer.activeLeadCount !== customerActiveLeadCount) {
    customer.leadCount = customerLeadCount
    customer.activeLeadCount = customerActiveLeadCount
    customer.updatedBy = admin.id
    customer = await customers.save(customer)
  }

  const resources = crmDataSource.getRepository(ResourceEntity)
  let resource = await resources.findOneBy({ code: "HOUSE-PINE" })
  if (!resource) {
    resource = await resources.save(resources.create({
      id: randomUUID(), code: "HOUSE-PINE", kind: "house", name: "Дом «Сосна»",
      capacityMode: "fixed", capacityTotal: 6,
      settings: { address: "Свистоплясово", preparationMinutes: 60, localSeed: true },
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  const demoResourceDefinitions = [
    { code: "HOUSE-LAKE", kind: "house", name: "Дом «Озеро»", capacityMode: "fixed", capacityTotal: 8, settings: { active: true, secondaryType: "Дом", colorKey: "sky", iconKey: "cottage", description: "Просторный демонстрационный дом у воды.", localSeed: true } },
    { code: "BATH-CEDAR", kind: "bath", name: "Баня «Кедр»", capacityMode: "fixed", capacityTotal: 6, settings: { active: true, secondaryType: "Баня", colorKey: "orange", iconKey: "bath", description: "Демонстрационная баня с комнатой отдыха.", localSeed: true } },
    { code: "VENUE-MEADOW", kind: "venue", name: "Поляна для мероприятий", capacityMode: "fixed", capacityTotal: 40, settings: { active: true, secondaryType: "Открытая площадка", spaceType: "outdoor", colorKey: "violet", iconKey: "map", description: "Демонстрационная площадка для событий.", localSeed: true } },
  ] as const
  for (const definition of demoResourceDefinitions) {
    if (!await resources.findOneBy({ code: definition.code })) {
      await resources.save(resources.create({ ...definition, id: randomUUID(), createdBy: admin.id, updatedBy: admin.id, archivedAt: null }))
    }
  }

  let demoHouseOffering: CatalogOfferingEntity | null = null
  const demoCampgroundOfferings: CatalogOfferingEntity[] = []
  if (process.env.APP_ENV !== "production") {
    const calendars = crmDataSource.getRepository(BusinessCalendarEntity)
    let calendar = await calendars.findOneBy({ code: "LOCAL-RU-2026" })
    if (!calendar) {
      calendar = await calendars.save(calendars.create({
        id: randomUUID(), code: "LOCAL-RU-2026", name: "Локальный календарь 2026",
        timezone: "Europe/Moscow", countryCode: "RU", source: "official_ru", sourceVersion: "local-seed-v1",
        state: "active", importedAt: new Date(), coverageFrom: "2026-09-01", coverageToExclusive: "2028-01-01",
        contentHash: "0".repeat(64), createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
    }
    if (calendar.coverageToExclusive !== "2028-01-01") {
      calendar.coverageToExclusive = "2028-01-01"
      calendar.updatedBy = admin.id
      calendar = await calendars.save(calendar)
    }
    const calendarDates = crmDataSource.getRepository(BusinessCalendarDateEntity)
    const existingCalendarDates = new Set((await calendarDates.findBy({ calendarId: calendar.id })).map((item) => item.localDate))
    const rows: BusinessCalendarDateEntity[] = []
    const holidays = new Map([["2026-11-04", "День народного единства"], ...Array.from({ length: 8 }, (_, index) => [`2027-01-${String(index + 1).padStart(2, "0")}`, "Новогодние каникулы"] as const)])
    for (let cursor = new Date("2026-09-01T00:00:00.000Z"); cursor < new Date("2028-01-01T00:00:00.000Z"); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const localDate = cursor.toISOString().slice(0, 10)
      if (existingCalendarDates.has(localDate)) continue
      const day = cursor.getUTCDay()
      rows.push(calendarDates.create({
        id: randomUUID(), calendarId: calendar.id, localDate,
        officialClass: holidays.has(localDate) ? "holiday" : day === 0 || day === 6 ? "weekend" : "weekday", officialLabel: holidays.get(localDate) ?? null,
        sourceVersion: "local-seed-v1", createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
    }
    if (rows.length) await calendarDates.save(rows, { chunk: 100 })
    for (const [localDate, officialLabel] of holidays) {
      await calendarDates.update({ calendarId: calendar.id, localDate }, { officialClass: "holiday", officialLabel, updatedBy: admin.id })
    }

    const offerings = crmDataSource.getRepository(CatalogOfferingEntity)
    let houseOffering = await offerings.findOneBy({ code: "HOUSE-PINE" })
    if (!houseOffering) {
      houseOffering = await offerings.save(offerings.create({
        id: randomUUID(), code: "HOUSE-PINE", kind: "house", operationalName: "Дом «Сосна»",
        internalComment: "Демонстрационное предложение локального окружения.", state: "draft",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow",
        taxMode: "tax_included", businessCalendarId: calendar.id, leadDirection: "Проживание",
        defaultAssigneeId: admin.id, scope: null, ownerOfferingId: null, activePriceBookId: null,
        createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
      await crmDataSource.getRepository(OfferingBindingEntity).save({
        id: randomUUID(), offeringId: houseOffering.id, resourceId: resource.id,
        resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null, role: "primary",
        quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 60,
        preparationAfterMinutes: 60, availabilityRequired: true,
        createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      })
      const priceBooks = crmDataSource.getRepository(PriceBookEntity)
      let activeBook = await priceBooks.save(priceBooks.create({
        id: randomUUID(), offeringId: houseOffering.id, revision: 1, name: "Базовые цены 2026",
        currency: "RUB", timezone: "Europe/Moscow", state: "draft", validFrom: "2026-09-01",
        validToExclusive: "2027-01-01", supersedesPriceBookId: null, changeReason: "Локальный seed",
        scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
        retiredAt: null, retiredBy: null, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
      await crmDataSource.getRepository(RatePlanEntity).save({
        id: randomUUID(), priceBookId: activeBook.id, key: "standard", label: "Стандартный тариф",
        pricingBasis: "per_night", baseAmountMinor: 1200000, baseExtraUnitAmountMinor: 150000,
        quantityMetric: "guests", includedQuantity: 4, minimumQuantity: 1, maximumQuantity: 6,
        minimumDurationMinutes: null, maximumDurationMinutes: null, sortOrder: 0, isDefault: true,
        createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      })
      activeBook.state = "active"
      activeBook.activatedAt = new Date()
      activeBook.activatedBy = admin.id
      activeBook = await priceBooks.save(activeBook)
      houseOffering.state = "active"
      houseOffering.activePriceBookId = activeBook.id
      houseOffering.pricingVersion += 1
      await offerings.save(houseOffering)
    }

    const housePriceBooks = crmDataSource.getRepository(PriceBookEntity)
    const houseRatePlans = crmDataSource.getRepository(RatePlanEntity)
    const housePriceRules = crmDataSource.getRepository(PriceRuleEntity)
    const activeHouseBook = houseOffering.activePriceBookId ? await housePriceBooks.findOneBy({ id: houseOffering.activePriceBookId }) : null
    if (activeHouseBook) {
      const standardPlan = await houseRatePlans.findOneBy({ priceBookId: activeHouseBook.id, isDefault: true })
      const hasDemoRules = standardPlan ? Boolean(await housePriceRules.findOneBy({ ratePlanId: standardPlan.id, selector: "recurring_weekdays", selectorLabel: "fri,sat,sun" })) : false
      if (standardPlan && !hasDemoRules) {
        let demoBook = await housePriceBooks.findOneBy({ offeringId: houseOffering.id, state: "draft" })
        if (!demoBook) demoBook = await housePriceBooks.save(housePriceBooks.create({
            id: randomUUID(), offeringId: houseOffering.id, revision: activeHouseBook.revision + 1, name: "Цены дома",
            currency: "RUB", timezone: "Europe/Moscow", state: "draft", validFrom: activeHouseBook.validFrom,
            validToExclusive: "2028-01-01", supersedesPriceBookId: activeHouseBook.id, changeReason: "Демо-цены по дням",
            scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
            retiredAt: null, retiredBy: null, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
          }))
        let demoPlan = await houseRatePlans.findOneBy({ priceBookId: demoBook.id, isDefault: true })
        if (!demoPlan) demoPlan = await houseRatePlans.save(houseRatePlans.create({
            id: randomUUID(), priceBookId: demoBook.id, key: "standard", label: "Основная цена",
            pricingBasis: "per_night", baseAmountMinor: 1200000, baseExtraUnitAmountMinor: 150000,
            quantityMetric: "guests", includedQuantity: 4, minimumQuantity: 1, maximumQuantity: 6,
            minimumDurationMinutes: null, maximumDurationMinutes: null, sortOrder: 0, isDefault: true,
            createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
          }))
        const demoRules = [
          { selector: "recurring_weekdays", selectorLabel: "fri,sat,sun", from: null, to: null, amount: 1400000, extra: 175000, priority: 0, reason: "Пятница и выходные" },
          { selector: "calendar_holiday", selectorLabel: null, from: null, to: null, amount: 1600000, extra: 200000, priority: 10, reason: "Праздничные дни" },
          { selector: "custom_date_override", selectorLabel: "Новый год", from: "2026-12-30", to: "2027-01-09", amount: 2200000, extra: 250000, priority: 20, reason: "Новогодний период" },
        ] as const
        for (const rule of demoRules) {
          const existingRule = rule.selectorLabel === null
            ? await housePriceRules.findOneBy({ ratePlanId: demoPlan.id, selector: rule.selector })
            : await housePriceRules.findOneBy({ ratePlanId: demoPlan.id, selector: rule.selector, selectorLabel: rule.selectorLabel })
          if (existingRule) continue
          await housePriceRules.save(housePriceRules.create({
            id: randomUUID(), ratePlanId: demoPlan.id, selector: rule.selector, dayClass: null,
            serviceDateFrom: rule.from, serviceDateToExclusive: rule.to, selectorLabel: rule.selectorLabel,
            minimumQuantity: null, maximumQuantity: null, minimumDurationMinutes: null, maximumDurationMinutes: null,
            minimumBookingLeadDays: null, maximumBookingLeadDays: null, amountMinor: rule.amount,
            extraUnitAmountMinor: rule.extra, priority: rule.priority, reason: rule.reason, enabled: true,
            createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
          }))
        }
        activeHouseBook.state = "retired"; activeHouseBook.retiredAt = new Date(); activeHouseBook.retiredBy = admin.id; activeHouseBook.updatedBy = admin.id
        await housePriceBooks.save(activeHouseBook)
        demoBook.state = "active"; demoBook.activatedAt = new Date(); demoBook.activatedBy = admin.id; demoBook.updatedBy = admin.id
        demoBook = await housePriceBooks.save(demoBook)
        houseOffering.activePriceBookId = demoBook.id; houseOffering.pricingVersion += 1; houseOffering.updatedBy = admin.id
        houseOffering = await offerings.save(houseOffering)
      }
    }

    const resourceGroups = crmDataSource.getRepository(ResourceGroupEntity)
    const groupMembers = crmDataSource.getRepository(ResourceGroupMemberEntity)
    const campgroundTerms = crmDataSource.getRepository(CampgroundOfferingTermsEntity)
    let campgroundGroup = await resourceGroups.findOneBy({ code: "CAMP-MEADOW" })
    if (!campgroundGroup) campgroundGroup = await resourceGroups.save(resourceGroups.create({
      id: randomUUID(), code: "CAMP-MEADOW", kind: "campground", name: "Кемпинг «Лесная поляна»", state: "active",
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
    const campgroundDefinitions = [
      {
        code: "CAMP-TENT-PINE", operationalName: "Шатёр «Сосновый»", resourceCode: "CAMP-TENT-PINE",
        resourceName: "Шатёр «Сосновый»", resourceKind: "campground_owned_tent", capacityMode: "fixed", capacityTotal: 4,
        salesUnit: "owned_tent", inventoryMode: "discrete_inventory", memberRole: "owned_tent", baseAmountMinor: 650000,
        baseExtraUnitAmountMinor: 100000, quantityMetric: "guests", includedQuantity: 2, minimumQuantity: 1, maximumQuantity: 4,
      },
      {
        code: "CAMP-OWN-TENT-AREA", operationalName: "Место для своей палатки", resourceCode: "CAMP-OWN-TENT-AREA",
        resourceName: "Общая зона для своих палаток", resourceKind: "campground_own_tent_area", capacityMode: "shared", capacityTotal: 15,
        salesUnit: "own_tent_pitch", inventoryMode: "shared_capacity", memberRole: "own_tent_area", baseAmountMinor: 120000,
        baseExtraUnitAmountMinor: null, quantityMetric: "units", includedQuantity: null, minimumQuantity: 1, maximumQuantity: 15,
      },
    ] as const
    for (const [index, definition] of campgroundDefinitions.entries()) {
      let campgroundResource = await resources.findOneBy({ code: definition.resourceCode })
      if (!campgroundResource) campgroundResource = await resources.save(resources.create({
        id: randomUUID(), code: definition.resourceCode, kind: definition.resourceKind, name: definition.resourceName,
        capacityMode: definition.capacityMode, capacityTotal: definition.capacityTotal,
        settings: { campgroundGroupCode: campgroundGroup.code, localSeed: true },
        createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
      if (!await groupMembers.findOneBy({ groupId: campgroundGroup.id, resourceId: campgroundResource.id })) {
        await groupMembers.save(groupMembers.create({
          id: randomUUID(), groupId: campgroundGroup.id, resourceId: campgroundResource.id,
          role: definition.memberRole, sortOrder: index, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
      }
      let campgroundOffering = await offerings.findOneBy({ code: definition.code })
      if (!campgroundOffering) campgroundOffering = await offerings.save(offerings.create({
        id: randomUUID(), code: definition.code, kind: "campground", operationalName: definition.operationalName,
        internalComment: "Демонстрационное campground offering локального окружения.", state: "active",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "quoted", priceDisplayMode: "from",
        currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: calendar.id,
        leadDirection: "Кемпинг", defaultAssigneeId: admin.id, scope: null, ownerOfferingId: null, activePriceBookId: null,
        createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
      }))
      if (!await campgroundTerms.findOneBy({ offeringId: campgroundOffering.id })) await campgroundTerms.save(campgroundTerms.create({
        offeringId: campgroundOffering.id, offeringKind: "campground", sellableUnit: definition.salesUnit,
        inventoryMode: definition.inventoryMode, capacityUnit: "tent", pricingBasis: "per_night", createdAt: new Date(), createdBy: admin.id,
      }))
      if (!await crmDataSource.getRepository(OfferingBindingEntity).findOneBy({ offeringId: campgroundOffering.id, role: "primary" })) {
        await crmDataSource.getRepository(OfferingBindingEntity).save({
          id: randomUUID(), offeringId: campgroundOffering.id, resourceId: campgroundResource.id,
          resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null, role: "primary",
          quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
          availabilityRequired: true, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        })
      }
      if (!campgroundOffering.activePriceBookId) {
        const campgroundPriceBooks = crmDataSource.getRepository(PriceBookEntity)
        let book = await campgroundPriceBooks.save(campgroundPriceBooks.create({
          id: randomUUID(), offeringId: campgroundOffering.id, revision: 1, name: "Базовые цены кемпинга 2026",
          currency: "RUB", timezone: "Europe/Moscow", state: "draft", validFrom: "2026-09-01", validToExclusive: "2027-01-01",
          supersedesPriceBookId: null, changeReason: "Локальный seed", scheduledActivationAt: null, scheduledBy: null,
          activatedAt: null, activatedBy: null, retiredAt: null, retiredBy: null,
          createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
        await crmDataSource.getRepository(RatePlanEntity).save({
          id: randomUUID(), priceBookId: book.id, key: "standard", label: "Стандартный тариф",
          pricingBasis: "per_night", baseAmountMinor: definition.baseAmountMinor, baseExtraUnitAmountMinor: definition.baseExtraUnitAmountMinor,
          quantityMetric: definition.quantityMetric, includedQuantity: definition.includedQuantity, minimumQuantity: definition.minimumQuantity,
          maximumQuantity: definition.maximumQuantity, minimumDurationMinutes: null, maximumDurationMinutes: null,
          sortOrder: 0, isDefault: true, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        })
        book.state = "active"; book.activatedAt = new Date(); book.activatedBy = admin.id
        book = await campgroundPriceBooks.save(book)
        campgroundOffering.activePriceBookId = book.id; campgroundOffering.pricingVersion += 1
        campgroundOffering = await offerings.save(campgroundOffering)
      }
      demoCampgroundOfferings.push(campgroundOffering)
    }

    const addOnTerms = crmDataSource.getRepository(AddonOfferingTermsEntity)
    const priceBooks = crmDataSource.getRepository(PriceBookEntity)
    const ratePlans = crmDataSource.getRepository(RatePlanEntity)
    const assignments = crmDataSource.getRepository(OfferingAddonAssignmentEntity)
    const reusableAddOns = [
      {
        code: "ADDON-FIREWOOD",
        operationalName: "Дрова для костра",
        internalComment: "Демонстрационный reusable add-on локального окружения.",
        serviceType: "quantity_service",
        categoryKey: "equipment",
        priceDisplayMode: "exact",
        rateLabel: "Одна корзина дров",
        baseAmountMinor: 45000,
        quantityMetric: "units",
        minimumQuantity: 1,
        maximumQuantity: 10,
        defaultQuantity: 2,
        quantityStep: 1,
        assignment: {
          groupKey: "comfort",
          minimumQuantity: 1,
          maximumQuantity: 6,
          defaultQuantity: 2,
          labelOverride: null,
          descriptionOverride: "Сухие дрова для вечернего костра.",
          displayOrder: 10,
        },
      },
      {
        code: "ADDON-BREAKFAST",
        operationalName: "Завтрак в корзине",
        internalComment: "Демонстрационный reusable add-on локального окружения.",
        serviceType: "person_service",
        categoryKey: "catering",
        priceDisplayMode: "exact",
        rateLabel: "Завтрак на гостя",
        baseAmountMinor: 90000,
        quantityMetric: "guests",
        minimumQuantity: 1,
        maximumQuantity: 6,
        defaultQuantity: 4,
        quantityStep: 1,
        assignment: {
          groupKey: "food",
          minimumQuantity: 1,
          maximumQuantity: 6,
          defaultQuantity: 4,
          labelOverride: null,
          descriptionOverride: "Корзина с завтраком к выбранной дате проживания.",
          displayOrder: 20,
        },
      },
      {
        code: "ADDON-TRANSFER",
        operationalName: "Трансфер от станции",
        internalComment: "Демонстрационный reusable add-on локального окружения.",
        serviceType: "quantity_service",
        categoryKey: "transfer",
        priceDisplayMode: "exact",
        rateLabel: "Одна поездка",
        baseAmountMinor: 150000,
        quantityMetric: "units",
        minimumQuantity: 1,
        maximumQuantity: 4,
        defaultQuantity: 1,
        quantityStep: 1,
        assignment: {
          groupKey: "transport",
          minimumQuantity: 1,
          maximumQuantity: 4,
          defaultQuantity: 1,
          labelOverride: null,
          descriptionOverride: "Встреча на станции и поездка до базы отдыха.",
          displayOrder: 30,
        },
      },
    ] as const

    const createdAssignments = []
    for (const definition of reusableAddOns) {
      let addOn = await offerings.findOneBy({ code: definition.code })
      if (!addOn) {
        addOn = await offerings.save(offerings.create({
          id: randomUUID(), code: definition.code, kind: "addon", operationalName: definition.operationalName,
          internalComment: definition.internalComment, state: "active", subjectVersion: 1, pricingVersion: 1,
          addonAssignmentsVersion: 1, salesMode: "selectable", priceDisplayMode: definition.priceDisplayMode,
          currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: calendar.id,
          leadDirection: "Дополнительные услуги", defaultAssigneeId: admin.id, scope: "reusable", ownerOfferingId: null,
          activePriceBookId: null, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
        const priceBook = await priceBooks.save(priceBooks.create({
          id: randomUUID(), offeringId: addOn.id, revision: 1, name: "Локальные цены 2026",
          currency: "RUB", timezone: "Europe/Moscow", state: "draft", validFrom: "2026-09-01",
          validToExclusive: "2027-01-01", supersedesPriceBookId: null, changeReason: "Локальный seed",
          scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
          retiredAt: null, retiredBy: null, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
        await ratePlans.save(ratePlans.create({
          id: randomUUID(), priceBookId: priceBook.id, key: "standard", label: definition.rateLabel,
          pricingBasis: definition.serviceType === "person_service" ? "per_person" : "per_unit",
          baseAmountMinor: definition.baseAmountMinor, baseExtraUnitAmountMinor: null,
          quantityMetric: definition.serviceType === "person_service" ? "participants" : definition.quantityMetric, includedQuantity: null,
          minimumQuantity: definition.minimumQuantity, maximumQuantity: definition.maximumQuantity,
          minimumDurationMinutes: null, maximumDurationMinutes: null, sortOrder: 0, isDefault: true,
          createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
        priceBook.state = "active"
        priceBook.activatedAt = new Date()
        priceBook.activatedBy = admin.id
        await priceBooks.save(priceBook)
        addOn.activePriceBookId = priceBook.id
        addOn.pricingVersion += 1
        addOn = await offerings.save(addOn)
      }

      let terms = await addOnTerms.findOneBy({ offeringId: addOn.id })
      if (!terms) terms = addOnTerms.create({ offeringId: addOn.id, offeringKind: "addon", createdAt: new Date(), createdBy: admin.id })
      terms.serviceType = definition.serviceType
      terms.standalone = true
      terms.categoryKey = definition.categoryKey
      terms.applicableOfferingKinds = ["house", "campground", "venue", "event_service", "program"]
      terms.minimumQuantity = definition.minimumQuantity
      terms.maximumQuantity = definition.maximumQuantity
      terms.defaultQuantity = definition.defaultQuantity
      terms.quantityStep = definition.quantityStep
      await addOnTerms.save(terms)

      const existingAssignment = await assignments.findOneBy({ offeringId: houseOffering.id, addonOfferingId: addOn.id })
      if (!existingAssignment && addOn.state === "active" && addOn.activePriceBookId) {
        await assignments.save(assignments.create({
          id: randomUUID(), offeringId: houseOffering.id, addonOfferingId: addOn.id, addonOfferingKind: "addon",
          enabled: true, required: false, recommended: true, groupKey: definition.assignment.groupKey,
          minimumQuantity: definition.assignment.minimumQuantity, maximumQuantity: definition.assignment.maximumQuantity,
          defaultQuantity: definition.assignment.defaultQuantity, displayOrder: definition.assignment.displayOrder,
          labelOverride: definition.assignment.labelOverride, descriptionOverride: definition.assignment.descriptionOverride,
          ratePlanKeyOverride: "standard", createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
        }))
        createdAssignments.push(addOn.id)
      }
    }
    if (createdAssignments.length > 0) {
      houseOffering.addonAssignmentsVersion += 1
      houseOffering.updatedBy = admin.id
      await offerings.save(houseOffering)
    }
    demoHouseOffering = houseOffering
  }

  const programCategories = crmDataSource.getRepository(ProgramCategoryEntity)
  let familyCategory = await programCategories.findOneBy({ name: "Семейные программы" })
  if (!familyCategory) familyCategory = await programCategories.save(programCategories.create({
    id: randomUUID(), name: "Семейные программы", description: "Совместные активности для взрослых и детей.",
    icon: "sparkles" satisfies ProgramCategoryCreate["icon"], tone: "sky" satisfies ProgramCategoryCreate["tone"],
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))
  if (!await programCategories.findOneBy({ name: "На природе" })) await programCategories.save(programCategories.create({
    id: randomUUID(), name: "На природе", description: "Маршруты, игры и мастер-классы на территории.",
    icon: "leaf" satisfies ProgramCategoryCreate["icon"], tone: "emerald" satisfies ProgramCategoryCreate["tone"],
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))

  const templates = crmDataSource.getRepository(ProgramTemplateEntity)
  let template = await templates.findOneBy({ code: "PROGRAM-FAMILY" })
  if (!template) {
    template = await templates.save(templates.create({
      id: randomUUID(), code: "PROGRAM-FAMILY", name: "Семейный день", categoryId: familyCategory.id,
      durationMinutes: 120, minimumParticipants: 2, participantLimit: 16, registrationCloseHours: 12,
      basePriceAmount: 250000, currency: "RUB", description: "Демонстрационная программа локального окружения.",
      publication: "draft", assigneeIds: [admin.id], stages: [
        { id: randomUUID(), name: "Встреча", durationMinutes: 15, comment: "" },
        { id: randomUUID(), name: "Основная программа", durationMinutes: 105, comment: "" },
      ], createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const occurrences = crmDataSource.getRepository(ProgramOccurrenceEntity)
  let occurrence = await occurrences.findOneBy({ code: "RUN-FAMILY-001" })
  if (!occurrence) {
    occurrence = await occurrences.save(occurrences.create({
      id: randomUUID(), code: "RUN-FAMILY-001", templateId: template.id, name: template.name,
      startsAt: new Date("2026-09-06T08:00:00.000Z"), endsAt: new Date("2026-09-06T10:00:00.000Z"),
      participantLimit: 16, registrationLimit: 16, status: "open", currency: "RUB",
      comment: "Демонстрационный запуск.", assigneeIds: [admin.id],
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const registrations = crmDataSource.getRepository(ProgramRegistrationEntity)
  if (!await registrations.findOneBy({ code: "REG-DEMO-001" })) await registrations.save(registrations.create({
    id: randomUUID(), code: "REG-DEMO-001", occurrenceId: occurrence.id, customerId: customer.id,
    phone: customer.phones[0] ?? "", participantCount: 3, participantNames: "Илья, Анна и Миша",
    totalAmount: 750000, discountAmount: 75000, paidAmount: 300000, currency: "RUB", status: "confirmed",
    promo: "FAMILY10", source: "Сайт", comment: "Демонстрационная регистрация с частичной оплатой.",
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))

  const eventCategories = crmDataSource.getRepository(EventCategoryEntity)
  let celebrationCategory = await eventCategories.findOneBy({ name: "Праздники" })
  if (!celebrationCategory) celebrationCategory = await eventCategories.save(eventCategories.create({
    id: randomUUID(), name: "Праздники", description: "Частные и семейные события.",
    icon: "cake" satisfies EventCategoryCreate["icon"], tone: "violet" satisfies EventCategoryCreate["tone"],
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))
  if (!await eventCategories.findOneBy({ name: "Корпоративные" })) await eventCategories.save(eventCategories.create({
    id: randomUUID(), name: "Корпоративные", description: "Командные выезды и деловые мероприятия.",
    icon: "building" satisfies EventCategoryCreate["icon"], tone: "sky" satisfies EventCategoryCreate["tone"],
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))

  const events = crmDataSource.getRepository(EventEntity)
  if (!await events.findOneBy({ code: "EVENT-001" })) {
    await events.save(events.create({
      id: randomUUID(), code: "EVENT-001", name: "Семейный праздник", categoryId: celebrationCategory.id, customerId: customer.id,
      phone: customer.phones[0] ?? "", startsAt: new Date("2026-09-12T09:00:00.000Z"), endsAt: new Date("2026-09-12T15:00:00.000Z"),
      guestCount: 12, totalAmount: 850000, paidAmount: 250000, currency: "RUB", status: "planning",
      comment: "Демонстрационное мероприятие.", requiresAction: true, assigneeIds: [admin.id],
      scenario: [{ id: randomUUID(), name: "Подготовка", durationMinutes: 60, comment: "" }],
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  if (!await events.findOneBy({ code: "EVENT-002" })) await events.save(events.create({
    id: randomUUID(), code: "EVENT-002", name: "Командный выезд", categoryId: null, customerId: null, phone: "+7 900 000-00-02",
    startsAt: new Date("2026-09-19T07:00:00.000Z"), endsAt: new Date("2026-09-19T14:00:00.000Z"), guestCount: 24,
    totalAmount: 1400000, paidAmount: 0, currency: "RUB", status: "inquiry", comment: "Нужно согласовать площадку и питание.",
    requiresAction: true, assigneeIds: [], scenario: [], createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))

  const bookings = crmDataSource.getRepository(BookingEntity)
  let booking = await bookings.findOneBy({ code: "BOOKING-LOCAL-001" })
  if (!booking) {
    booking = await bookings.save(bookings.create({
      id: randomUUID(), code: "BOOKING-LOCAL-001", customerId: customer.id, status: "confirmed", currency: "RUB",
      totalAmount: 480000, snapshot: {
        guestCount: 4, source: "Телефон", utm: "direct", promo: "Без промокода",
        assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }], note: "Демонстрационная бронь.",
      }, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const bookingItems = crmDataSource.getRepository(BookingItemEntity)
  let bookingItem = await bookingItems.findOneBy({ bookingId: booking.id })
  if (!bookingItem) {
    bookingItem = await bookingItems.save(bookingItems.create({
      id: randomUUID(), bookingId: booking.id, type: "accommodation", resourceId: resource.id,
      startAt: new Date("2026-09-05T09:00:00.000Z"), endAt: new Date("2026-09-07T09:00:00.000Z"),
      quantity: 1, priceAmount: 480000, discountAmount: 0, currency: "RUB", preparationMinutes: 60,
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }

  const allocations = crmDataSource.getRepository(ResourceAllocationEntity)
  if (!await allocations.findOneBy({ sourceId: bookingItem.id, sourceType: "booking_item" })) {
    await allocations.save(allocations.create({
      id: randomUUID(), resourceId: resource.id, sourceType: "booking_item", sourceId: bookingItem.id,
      startAt: new Date("2026-09-05T08:00:00.000Z"), endAt: new Date("2026-09-07T09:00:00.000Z"),
      quantity: 1, capacityImpact: 1, exclusive: true, status: "active",
      createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  const blockSourceId = "00000000-0000-4000-8000-000000000101"
  let demoBlock = await allocations.findOneBy({ sourceId: blockSourceId, sourceType: "resource_block" })
  if (!demoBlock) demoBlock = await allocations.save(allocations.create({
    id: randomUUID(), resourceId: resource.id, sourceType: "resource_block", sourceId: blockSourceId,
    startAt: new Date("2026-09-10T06:00:00.000Z"), endAt: new Date("2026-09-10T10:00:00.000Z"),
    quantity: 1, capacityImpact: 1, exclusive: true, status: "active",
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))
  const resourceSettings = { ...resource.settings, blockMetadata: { ...((resource.settings.blockMetadata as Record<string, unknown> | undefined) ?? {}), [demoBlock.id]: { reason: "Плановое обслуживание" } } }
  if (JSON.stringify(resource.settings) !== JSON.stringify(resourceSettings)) {
    resource.settings = resourceSettings
    resource.updatedBy = admin.id
    resource = await resources.save(resource)
  }

  const payments = crmDataSource.getRepository(PaymentEntity)
  if (!await payments.findOneBy({ bookingId: booking.id, kind: "charge" })) {
    await payments.save(payments.create({
      id: randomUUID(), operationId: randomUUID(), bookingId: booking.id, kind: "charge", amount: 240000,
      currency: "RUB", method: "card", sourcePaymentId: null, reason: "Предоплата локального seed",
      createdAt: new Date("2026-08-30T12:00:00.000Z"), createdBy: admin.id,
    }))
  }

  await seedMarketingDemoData(crmDataSource, admin.id, booking.id, { resourceId: resource.id, ...(demoHouseOffering ? { offeringId: demoHouseOffering.id } : {}) })

  const bookingAggregates = await crmDataSource.query(`
    WITH booking_summary AS (
      SELECT booking.id, booking.status, booking.total_amount, max(item.end_at) AS end_at,
        COALESCE(sum(payment.amount) FILTER (WHERE payment.kind IN ('charge','adjustment')), 0)::integer
          - COALESCE(sum(payment.amount) FILTER (WHERE payment.kind = 'refund'), 0)::integer AS paid
      FROM bookings booking
      LEFT JOIN booking_items item ON item.booking_id = booking.id AND item.archived_at IS NULL
      LEFT JOIN payments payment ON payment.booking_id = booking.id
      WHERE booking.customer_id = $1 AND booking.archived_at IS NULL
      GROUP BY booking.id, booking.status, booking.total_amount
    )
    SELECT count(*)::integer AS booking_count,
      count(*) FILTER (WHERE end_at > now() AND status NOT IN ('cancelled','archived'))::integer AS future_booking_count,
      COALESCE(sum(paid), 0)::integer AS turnover,
      COALESCE(sum(GREATEST(0, total_amount - paid)), 0)::integer AS debt
    FROM booking_summary
  `, [customer.id]) as Array<{ booking_count: number; future_booking_count: number; turnover: number; debt: number }>
  const bookingSummary = bookingAggregates[0]
  if (bookingSummary && (
    customer.bookingCount !== bookingSummary.booking_count
    || customer.futureBookingCount !== bookingSummary.future_booking_count
    || customer.turnover !== bookingSummary.turnover
    || customer.debt !== bookingSummary.debt
  )) {
    customer.bookingCount = bookingSummary.booking_count
    customer.futureBookingCount = bookingSummary.future_booking_count
    customer.turnover = bookingSummary.turnover
    customer.debt = bookingSummary.debt
    customer.updatedBy = admin.id
    customer = await customers.save(customer)
  }

  const tasks = crmDataSource.getRepository(TaskEntity)
  if (!await tasks.findOneBy({ code: "T-184" })) {
    await tasks.save(tasks.create({
      id: randomUUID(), code: "T-184", title: "Уточнить финальный состав гостей",
      details: "Получить список взрослых и детей до подготовки домика.", status: "todo", priority: "high",
      dueAt: new Date("2026-08-24T08:00:00.000Z"), reminderMinutes: null,
      relation: { type: "booking", label: "Бронь #2051 · Дом «Озеро»", href: "/bookings/2051" },
      assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }], commentCount: 0,
      latestComment: null, blocked: false, createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
    }))
  }
  const extraTasks = [
    { code: "T-DEMO-002", title: "Подтвердить меню мероприятия", details: "Получить финальный выбор блюд и количество детских порций.", status: "in_progress", priority: "normal" satisfies TaskPriority, dueAt: new Date("2026-09-08T10:00:00.000Z"), relation: { type: "event", label: "Событие EVENT-001 · Семейный праздник", href: "/events/EVENT-001" }, blocked: false },
    { code: "T-DEMO-003", title: "Проверить площадку после дождя", details: "Оценить состояние подъезда и подготовить запасной сценарий.", status: "todo", priority: "high", dueAt: new Date("2026-09-05T06:00:00.000Z"), relation: { type: "resource", label: "Поляна для мероприятий", href: "/resources/venues/VENUE-MEADOW" }, blocked: true },
  ] as const
  for (const task of extraTasks) if (!await tasks.findOneBy({ code: task.code })) await tasks.save(tasks.create({
    ...task, id: randomUUID(), reminderMinutes: 60, assignees: [{ id: admin.id, name: admin.displayName, initials: "А" }],
    commentCount: task.blocked ? 1 : 0, latestComment: task.blocked ? "Нужен осмотр на месте" : null,
    createdBy: admin.id, updatedBy: admin.id, archivedAt: null,
  }))
  if (process.env.APP_ENV !== "production") {
    await seedCmsDemoData(crmDataSource, admin.id, resource.id, resource.version)
    if (demoHouseOffering) {
      const locator = await crmDataSource.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, {
        offeringId: demoHouseOffering!.id, actorId: admin.id, requestId: "development-seed:catalog-offering-editorial-locator",
      }))
      if (locator.status === "report_only") console.warn(`[seed] house editorial locator requires reconciliation: ${JSON.stringify(locator.report)}`)
    }
    for (const offering of demoCampgroundOfferings) {
      const locator = await crmDataSource.transaction((manager) => ensureCatalogOfferingEditorialDraft(manager, {
        offeringId: offering.id, actorId: admin.id, requestId: "development-seed:campground-editorial-locator",
      }))
      if (locator.status === "report_only") console.warn(`[seed] campground editorial locator requires reconciliation: ${JSON.stringify(locator.report)}`)
    }
  }
  await crmDataSource.destroy()
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
