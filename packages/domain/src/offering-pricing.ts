import { DomainError } from "./errors.js";

export type LocalDate = string;
export type HouseDayClass = "weekday" | "weekend" | "holiday";
export type PricingWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type HouseInclusiveRange = Readonly<{ min: number; max: number | null }>;
export type HouseDateSelector =
  | Readonly<{ type: "any_date" }>
  | Readonly<{ type: "day_class"; dayClass: "weekday" | "weekend" }>
  | Readonly<{ type: "recurring_weekdays"; days: readonly PricingWeekday[] }>
  | Readonly<{ type: "calendar_holiday" }>
  | Readonly<{ type: "custom_date_override"; from: LocalDate; toExclusive: LocalDate; label: string }>;

export interface HousePriceRule {
  readonly id: string;
  readonly version: number;
  readonly dateSelector: HouseDateSelector;
  readonly quantityRange: HouseInclusiveRange | null;
  readonly bookingLeadDays: HouseInclusiveRange | null;
  readonly durationMinutes: HouseInclusiveRange | null;
  readonly amountMinor: number | null;
  readonly extraUnitAmountMinor: number | null;
  readonly priority: number;
  readonly reason: string;
  readonly enabled: boolean;
  readonly archived?: boolean;
}

export interface HouseRatePlan {
  readonly id: string;
  readonly version: number;
  readonly priceBookId: string;
  readonly key: string;
  readonly label: string;
  readonly pricingBasis: string;
  readonly quantityMetric: "guests" | "participants" | "units" | null;
  readonly baseAmountMinor: number;
  readonly includedQuantity: number | null;
  readonly baseExtraUnitAmountMinor: number | null;
  readonly minQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly minDurationMinutes: number | null;
  readonly maxDurationMinutes: number | null;
  readonly isDefault: boolean;
  readonly rules: readonly HousePriceRule[];
  readonly archived?: boolean;
}

export interface HouseCalendarDate {
  readonly date: LocalDate;
  readonly official: Readonly<{
    id: string;
    version: number;
    dayClass: HouseDayClass;
    sourceVersion: string;
  }>;
  readonly activeOverride: Readonly<{
    id: string;
    version: number;
    dayClass: HouseDayClass;
    reason: string;
  }> | null;
}

export interface HousePricingSnapshot {
  readonly offering: Readonly<{
    id: string;
    version: number;
    pricingVersion: number;
    kind: string;
    state: string;
    currency: string;
    timezone: string;
    businessCalendarId: string;
    activePriceBookId: string | null;
  }>;
  readonly priceBook: Readonly<{
    id: string;
    version: number;
    revision: number;
    offeringId: string;
    state: string;
    currency: string;
    timezone: string;
    validFrom: LocalDate;
    validToExclusive: LocalDate | null;
  }>;
  readonly ratePlans: readonly HouseRatePlan[];
  readonly calendar: Readonly<{
    id: string;
    version: number;
    state: string;
    timezone: string;
    sourceVersion: string;
    dates: readonly HouseCalendarDate[];
  }>;
}

export interface HouseQuoteRequest {
  readonly offeringId: string;
  readonly ratePlanKey: string | null;
  readonly arrivalDate: LocalDate;
  readonly departureDate: LocalDate;
  readonly guests: number | null;
  readonly units: number;
  readonly currency: string;
}

export interface CampgroundQuoteRequest extends HouseQuoteRequest {
  readonly salesUnit: "owned_tent" | "own_tent_pitch";
  readonly allocationMode: "discrete_inventory" | "shared_capacity";
}

export interface TrustedQuoteContext {
  readonly quoteId: string;
  readonly calculatedAt: Date;
  readonly quoteTtlSeconds: number;
  readonly nextPricingActivationAt: Date | null;
}

export interface AddOnQuoteRequest {
  readonly offeringId: string;
  readonly ratePlanKey: string | null;
  readonly serviceDate: LocalDate;
  readonly quantity: number;
  readonly serviceType: "quantity_service" | "person_service";
  readonly currency: string;
}

export interface AddOnQuoteCalculation {
  readonly offeringId: string;
  readonly offeringVersion: number;
  readonly pricingVersion: number;
  readonly priceBookId: string;
  readonly priceBookVersion: number;
  readonly calendarId: string;
  readonly calendarVersion: number;
  readonly calendarSourceVersion: string;
  readonly serviceDate: LocalDate;
  readonly quantity: number;
  readonly unitAmountMinor: number;
  readonly totalAmountMinor: number;
  readonly currency: string;
  readonly ratePlan: Readonly<{ id: string; version: number; key: string }>;
  readonly matchedRule: Readonly<{ id: string; version: number; selector: HouseDateSelector; priority: number }> | null;
}

export interface HouseQuoteLine {
  readonly serviceDate: LocalDate;
  readonly baseAmountMinor: number;
  readonly extraGuestCount: number;
  readonly extraGuestAmountMinor: number;
  readonly totalAmountMinor: number;
  readonly ratePlan: Readonly<{ id: string; version: number; key: string }>;
  readonly matchedRule: Readonly<{
    id: string;
    version: number;
    selector: HouseDateSelector;
    priority: number;
  }> | null;
  readonly calendar: Readonly<{
    id: string;
    version: number;
    sourceVersion: string;
    officialDateId: string;
    officialDateVersion: number;
    overrideId: string | null;
    overrideVersion: number | null;
    effectiveClass: HouseDayClass;
  }>;
}

export interface HouseQuoteCalculation {
  readonly quoteId: string;
  readonly input: HouseQuoteRequest;
  readonly offeringId: string;
  readonly offeringVersion: number;
  readonly pricingVersion: number;
  readonly priceBookId: string;
  readonly priceBookVersion: number;
  readonly priceBookRevision: number;
  readonly calendarId: string;
  readonly calendarVersion: number;
  readonly calendarSourceVersion: string;
  readonly calculatedAt: string;
  readonly quoteLocalDate: LocalDate;
  readonly leadDays: number;
  readonly validUntil: string;
  readonly currency: string;
  readonly timezone: string;
  readonly lines: readonly HouseQuoteLine[];
  readonly totalAmountMinor: number;
  readonly immutableSnapshot: true;
}

export interface HousePricingValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly ruleIds?: readonly string[];
}

export interface HousePricingCoverageWindow {
  readonly from: LocalDate;
  readonly toExclusive: LocalDate;
}

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function resolveHousePerNightQuote(
  snapshot: HousePricingSnapshot,
  request: HouseQuoteRequest,
  context: TrustedQuoteContext,
): HouseQuoteCalculation {
  assertQuoteInputs(snapshot, request, context);
  const quoteLocalDate = localDateInTimeZone(context.calculatedAt, snapshot.offering.timezone);
  const leadDays = daysBetween(quoteLocalDate, request.arrivalDate);
  if (leadDays < 0) fail("QUOTE_SERVICE_DATE_IN_PAST", "Дата заезда уже прошла");

  const ratePlan = selectRatePlan(snapshot, request.ratePlanKey);
  validateRatePlanForQuote(ratePlan, request.guests);
  const dates = enumerateDates(request.arrivalDate, request.departureDate);
  const calendarByDate = uniqueCalendarDates(snapshot.calendar.dates);
  const lines = dates.map((date) => calculateNight(snapshot, ratePlan, request, date, leadDays, calendarByDate));
  const totalAmountMinor = safeSum(lines.map((line) => line.totalAmountMinor));
  const ttlEnd = new Date(context.calculatedAt.getTime() + context.quoteTtlSeconds * 1000);
  const validUntil = context.nextPricingActivationAt && context.nextPricingActivationAt < ttlEnd
    ? context.nextPricingActivationAt
    : ttlEnd;

  return deepFreeze({
    quoteId: context.quoteId,
    input: { ...request },
    offeringId: snapshot.offering.id,
    offeringVersion: snapshot.offering.version,
    pricingVersion: snapshot.offering.pricingVersion,
    priceBookId: snapshot.priceBook.id,
    priceBookVersion: snapshot.priceBook.version,
    priceBookRevision: snapshot.priceBook.revision,
    calendarId: snapshot.calendar.id,
    calendarVersion: snapshot.calendar.version,
    calendarSourceVersion: snapshot.calendar.sourceVersion,
    calculatedAt: context.calculatedAt.toISOString(),
    quoteLocalDate,
    leadDays,
    validUntil: validUntil.toISOString(),
    currency: request.currency,
    timezone: snapshot.offering.timezone,
    lines,
    totalAmountMinor,
    immutableSnapshot: true as const,
  });
}

/**
 * Internal price preview for campground stays. It deliberately resolves price
 * only; availability is not asserted here and the API stores no acceptance
 * context until authoritative allocations are implemented.
 */
export function resolveCampgroundPerNightQuote(
  snapshot: HousePricingSnapshot,
  request: CampgroundQuoteRequest,
  context: TrustedQuoteContext,
): HouseQuoteCalculation {
  assertCommonQuoteInputs(snapshot, request, context, "campground");
  if (
    (request.salesUnit === "owned_tent" && request.allocationMode !== "discrete_inventory")
    || (request.salesUnit === "own_tent_pitch" && request.allocationMode !== "shared_capacity")
  ) fail("OFFERING_NOT_QUOTABLE", "Тип кемпинга не совпадает с режимом аллокации");
  if (request.salesUnit === "owned_tent" && request.units !== 1) fail("CAMPGROUND_QUOTE_UNSUPPORTED_QUANTITY", "Один расчёт собственного шатра поддерживает одну единицу");
  if (!Number.isSafeInteger(request.units) || request.units <= 0) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество палаточных мест должно быть положительным");

  const quoteLocalDate = localDateInTimeZone(context.calculatedAt, snapshot.offering.timezone);
  const leadDays = daysBetween(quoteLocalDate, request.arrivalDate);
  if (leadDays < 0) fail("QUOTE_SERVICE_DATE_IN_PAST", "Дата заезда уже прошла");
  const ratePlan = selectRatePlan(snapshot, request.ratePlanKey);
  validateCampgroundRatePlanForQuote(ratePlan, request);
  const calendarByDate = uniqueCalendarDates(snapshot.calendar.dates);
  const lines = enumerateDates(request.arrivalDate, request.departureDate).map((date) =>
    calculateCampgroundNight(snapshot, ratePlan, request, date, leadDays, calendarByDate));
  const totalAmountMinor = safeSum(lines.map((line) => line.totalAmountMinor));
  const ttlEnd = new Date(context.calculatedAt.getTime() + context.quoteTtlSeconds * 1000);
  const validUntil = context.nextPricingActivationAt && context.nextPricingActivationAt < ttlEnd
    ? context.nextPricingActivationAt
    : ttlEnd;
  return deepFreeze({
    quoteId: context.quoteId,
    input: { ...request },
    offeringId: snapshot.offering.id,
    offeringVersion: snapshot.offering.version,
    pricingVersion: snapshot.offering.pricingVersion,
    priceBookId: snapshot.priceBook.id,
    priceBookVersion: snapshot.priceBook.version,
    priceBookRevision: snapshot.priceBook.revision,
    calendarId: snapshot.calendar.id,
    calendarVersion: snapshot.calendar.version,
    calendarSourceVersion: snapshot.calendar.sourceVersion,
    calculatedAt: context.calculatedAt.toISOString(),
    quoteLocalDate,
    leadDays,
    validUntil: validUntil.toISOString(),
    currency: request.currency,
    timezone: snapshot.offering.timezone,
    lines,
    totalAmountMinor,
    immutableSnapshot: true as const,
  });
}

/** Resolve one assigned service occurrence on a concrete local date. */
export function resolveAddOnServiceDateQuote(
  snapshot: HousePricingSnapshot,
  request: AddOnQuoteRequest,
  context: TrustedQuoteContext,
): AddOnQuoteCalculation {
  if (!Number.isFinite(context.calculatedAt.getTime())) fail("QUOTE_CLOCK_INVALID", "Серверное время расчёта некорректно");
  if (snapshot.offering.id !== request.offeringId || snapshot.offering.kind !== "addon" || snapshot.offering.state !== "active") fail("OFFERING_NOT_QUOTABLE", "Дополнительную услугу нельзя рассчитать");
  if (!isLocalDate(request.serviceDate)) fail("HOUSE_QUOTE_INVALID_PERIOD", "Некорректная дата дополнительной услуги");
  if (!Number.isSafeInteger(request.quantity) || request.quantity <= 0) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество дополнительной услуги должно быть положительным");
  if (snapshot.priceBook.state !== "active" || snapshot.offering.activePriceBookId !== snapshot.priceBook.id || snapshot.priceBook.offeringId !== snapshot.offering.id) fail("PRICE_BOOK_NOT_ACTIVE", "Прайс-лист дополнительной услуги не активен");
  if (request.currency !== snapshot.offering.currency || request.currency !== snapshot.priceBook.currency) fail("PRICING_CURRENCY_MISMATCH", "Валюта дополнительной услуги не совпадает с валютой брони");
  if (request.serviceDate < snapshot.priceBook.validFrom || (snapshot.priceBook.validToExclusive !== null && request.serviceDate >= snapshot.priceBook.validToExclusive)) fail("PRICE_BOOK_COVERAGE_GAP", "Прайс-лист не покрывает дату дополнительной услуги");
  if (snapshot.calendar.state !== "active" || snapshot.offering.businessCalendarId !== snapshot.calendar.id) fail("CALENDAR_NOT_ACTIVE", "Календарь дополнительной услуги не активен");
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) fail("PRICING_TIMEZONE_MISMATCH", "Часовые пояса дополнительной услуги и календаря различаются");

  const quoteLocalDate = localDateInTimeZone(context.calculatedAt, snapshot.offering.timezone);
  const leadDays = daysBetween(quoteLocalDate, request.serviceDate);
  if (leadDays < 0) fail("QUOTE_SERVICE_DATE_IN_PAST", "Дата дополнительной услуги уже прошла");
  const plan = selectRatePlan(snapshot, request.ratePlanKey);
  const expectedBasis = request.serviceType === "quantity_service" ? "per_unit" : "per_person";
  const expectedMetric = request.serviceType === "quantity_service" ? "units" : "participants";
  if (plan.pricingBasis !== expectedBasis || plan.quantityMetric !== expectedMetric) fail("RATE_PLAN_BASIS_UNSUPPORTED", "Тариф дополнительной услуги не соответствует её типу");
  if (!isMinor(plan.baseAmountMinor)) fail("PRICE_RULE_INVALID", "Базовая сумма дополнительной услуги некорректна");

  const calendarDate = uniqueCalendarDates(snapshot.calendar.dates).get(request.serviceDate);
  if (!calendarDate) fail("CALENDAR_DATE_MISSING", `Дата ${request.serviceDate} отсутствует в производственном календаре`);
  const effectiveClass = calendarDate.activeOverride?.dayClass ?? calendarDate.official.dayClass;
  const matching = plan.rules.filter((rule) => rule.enabled && !rule.archived && matchesRule(rule, request.serviceDate, effectiveClass, request.quantity, leadDays));
  const ranked = matching.map((rule) => ({ rule, rank: ruleRank(rule) })).sort((a, b) => compareRank(b.rank, a.rank));
  if (ranked.length > 1 && compareRank(ranked[0]!.rank, ranked[1]!.rank) === 0) fail("PRICE_RULE_AMBIGUOUS", "Для дополнительной услуги найдено несколько правил одинакового ранга", { ruleIds: [ranked[0]!.rule.id, ranked[1]!.rule.id] });
  const rule = ranked[0]?.rule ?? null;
  const unitAmountMinor = rule?.amountMinor ?? plan.baseAmountMinor;
  if (!isMinor(unitAmountMinor)) fail("PRICE_RULE_INVALID", "Правило дополнительной услуги содержит некорректную сумму");

  return deepFreeze({
    offeringId: snapshot.offering.id,
    offeringVersion: snapshot.offering.version,
    pricingVersion: snapshot.offering.pricingVersion,
    priceBookId: snapshot.priceBook.id,
    priceBookVersion: snapshot.priceBook.version,
    calendarId: snapshot.calendar.id,
    calendarVersion: snapshot.calendar.version,
    calendarSourceVersion: snapshot.calendar.sourceVersion,
    serviceDate: request.serviceDate,
    quantity: request.quantity,
    unitAmountMinor,
    totalAmountMinor: safeMultiply(request.quantity, unitAmountMinor),
    currency: request.currency,
    ratePlan: { id: plan.id, version: plan.version, key: plan.key },
    matchedRule: rule ? { id: rule.id, version: rule.version, selector: rule.dateSelector, priority: rule.priority } : null,
  });
}

export function validateCampgroundPricingForActivation(
  snapshot: HousePricingSnapshot,
  coverageWindow: HousePricingCoverageWindow,
  salesUnit: "owned_tent" | "own_tent_pitch",
): readonly HousePricingValidationIssue[] {
  const issues = [...validateHousePricingForActivation(snapshot, coverageWindow)];
  for (const plan of snapshot.ratePlans.filter((candidate) => !candidate.archived)) {
    const expectedMetric = salesUnit === "own_tent_pitch" ? "units" : null;
    if (plan.quantityMetric !== expectedMetric) issues.push({
      code: "RATE_PLAN_QUANTITY_UNSUPPORTED",
      path: `ratePlans.${plan.id}.quantityMetric`,
      message: salesUnit === "own_tent_pitch" ? "Тариф общей зоны должен учитывать количество палаточных мест" : "Тариф собственного шатра не должен масштабироваться по units",
    });
    if (plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null) issues.push({
      code: "RATE_PLAN_QUANTITY_UNSUPPORTED",
      path: `ratePlans.${plan.id}`,
      message: "Кемпинг использует прямую цену за продаваемую единицу, без extra-unit доплаты",
    });
  }
  return deepFreeze(issues);
}

/**
 * First add-on pricing slice deliberately supports only direct unit/person
 * tariffs. Calendar/date rules remain reusable, while quantity/duration/lead
 * dimensions stay out until the add-on quote resolver owns their semantics.
 */
export function validateAddOnPricingForActivation(
  snapshot: HousePricingSnapshot,
  coverageWindow: HousePricingCoverageWindow,
  serviceType: "quantity_service" | "person_service",
): readonly HousePricingValidationIssue[] {
  const issues = validateHousePricingForActivation(snapshot, coverageWindow)
    .filter((issue) => issue.code !== "RATE_PLAN_BASIS_UNSUPPORTED");
  const expectedBasis = serviceType === "quantity_service" ? "per_unit" : "per_person";
  const expectedMetric = serviceType === "quantity_service" ? "units" : "participants";
  for (const plan of snapshot.ratePlans.filter((candidate) => !candidate.archived)) {
    if (plan.pricingBasis !== expectedBasis) issues.push({
      code: "RATE_PLAN_BASIS_UNSUPPORTED",
      path: `ratePlans.${plan.id}.pricingBasis`,
      message: serviceType === "quantity_service" ? "Количественная услуга использует цену за единицу" : "Услуга для гостей использует цену за участника",
    });
    if (plan.quantityMetric !== expectedMetric) issues.push({
      code: "PRICE_RULE_INVALID",
      path: `ratePlans.${plan.id}.quantityMetric`,
      message: serviceType === "quantity_service" ? "Количественная услуга использует metric=units" : "Услуга для гостей использует metric=participants",
    });
    if (
      plan.includedQuantity !== null
      || plan.baseExtraUnitAmountMinor !== null
      || plan.minQuantity !== null
      || plan.maxQuantity !== null
    ) issues.push({
      code: "UNSUPPORTED_PRICING_DIMENSION",
      path: `ratePlans.${plan.id}`,
      message: "Количество задаётся operational terms; included/extra и тарифные quantity limits появятся вместе с add-on resolver",
    });
    for (const rule of plan.rules.filter((rule) => rule.enabled && !rule.archived)) {
      if (rule.quantityRange !== null || rule.bookingLeadDays !== null || rule.durationMinutes !== null) issues.push({
        code: "UNSUPPORTED_PRICING_DIMENSION",
        path: `priceRules.${rule.id}`,
        message: "Первый add-on slice поддерживает только календарный selector и сумму",
      });
    }
  }
  return deepFreeze(issues);
}

/** Venue pricing reuses the shared PriceBook/rule runtime; only its commercial basis is narrowed here. */
export function validateVenuePricingForActivation(
  snapshot: HousePricingSnapshot,
  coverageWindow: HousePricingCoverageWindow,
): readonly HousePricingValidationIssue[] {
  const issues = validateHousePricingForActivation(snapshot, coverageWindow)
    .filter((issue) => issue.code !== "RATE_PLAN_BASIS_UNSUPPORTED" && !(
      issue.code === "UNSUPPORTED_PRICING_DIMENSION"
      && issue.path.startsWith("priceRules.")
      && issue.path.endsWith(".durationMinutes")
    ));
  const supportedBases = new Set(["per_day", "per_slot", "per_hour", "flat_package"]);
  for (const plan of snapshot.ratePlans.filter((candidate) => !candidate.archived)) {
    if (!supportedBases.has(plan.pricingBasis)) issues.push({
      code: "RATE_PLAN_BASIS_UNSUPPORTED",
      path: `ratePlans.${plan.id}.pricingBasis`,
      message: "Площадка использует per_day, per_slot, per_hour или flat_package",
    });
    if (plan.quantityMetric !== "guests") issues.push({
      code: "RATE_PLAN_QUANTITY_UNSUPPORTED",
      path: `ratePlans.${plan.id}.quantityMetric`,
      message: "Тариф площадки должен использовать quantityMetric=guests",
    });
    if (plan.includedQuantity === null || plan.baseExtraUnitAmountMinor === null) issues.push({
      code: "RATE_PLAN_QUANTITY_UNSUPPORTED",
      path: `ratePlans.${plan.id}`,
      message: "Тариф площадки должен задавать includedQuantity и extraUnitPrice для гостей",
    });
    if (plan.minDurationMinutes !== null && plan.minDurationMinutes <= 0) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.minDurationMinutes`, message: "Минимальная длительность должна быть положительной" });
    if (plan.maxDurationMinutes !== null && plan.maxDurationMinutes <= 0) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.maxDurationMinutes`, message: "Максимальная длительность должна быть положительной" });
    if (plan.minDurationMinutes !== null && plan.maxDurationMinutes !== null && plan.minDurationMinutes > plan.maxDurationMinutes) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.maxDurationMinutes`, message: "Максимальная длительность меньше минимальной" });
    for (const rule of plan.rules.filter((rule) => rule.enabled && !rule.archived)) {
      if (rule.durationMinutes !== null) issues.push({ code: "UNSUPPORTED_PRICING_DIMENSION", path: `priceRules.${rule.id}.durationMinutes`, message: "Duration-правила площадки пока не поддерживаются; используйте bounds тарифа" });
    }
  }
  return deepFreeze(issues);
}

export function validateHousePricingForActivation(
  snapshot: HousePricingSnapshot,
  coverageWindow: HousePricingCoverageWindow,
): readonly HousePricingValidationIssue[] {
  const issues: HousePricingValidationIssue[] = [];
  if (!isLocalDate(coverageWindow.from) || !isLocalDate(coverageWindow.toExclusive) || coverageWindow.from >= coverageWindow.toExclusive) {
    return [{ code: "INVALID_COVERAGE_WINDOW", path: "coverageWindow", message: "Некорректное окно проверки" }];
  }
  if (coverageWindow.from < snapshot.priceBook.validFrom || (snapshot.priceBook.validToExclusive !== null && coverageWindow.toExclusive > snapshot.priceBook.validToExclusive)) {
    issues.push({ code: "PRICE_BOOK_COVERAGE_GAP", path: "priceBook.validity", message: "Прайс-лист не покрывает окно активации" });
  }
  if (snapshot.calendar.state !== "active") issues.push({ code: "CALENDAR_NOT_ACTIVE", path: "calendar.state", message: "Бизнес-календарь не активен" });
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) {
    issues.push({ code: "PRICING_TIMEZONE_MISMATCH", path: "timezone", message: "Часовые пояса предложения, календаря и прайса различаются" });
  }
  if (snapshot.offering.currency !== snapshot.priceBook.currency) {
    issues.push({ code: "PRICING_CURRENCY_MISMATCH", path: "currency", message: "Валюты предложения и прайса различаются" });
  }

  const calendarCounts = new Map<string, number>();
  for (const day of snapshot.calendar.dates) calendarCounts.set(day.date, (calendarCounts.get(day.date) ?? 0) + 1);
  for (const date of enumerateDates(coverageWindow.from, coverageWindow.toExclusive)) {
    const count = calendarCounts.get(date) ?? 0;
    if (count !== 1) issues.push({
      code: count === 0 ? "CALENDAR_DATE_MISSING" : "CALENDAR_DATE_AMBIGUOUS",
      path: `calendar.dates.${date}`,
      message: count === 0 ? "Дата отсутствует в производственном календаре" : "Для даты найдено несколько календарных записей",
    });
  }

  const defaults = snapshot.ratePlans.filter((plan) => !plan.archived && plan.isDefault);
  if (defaults.length !== 1) issues.push({ code: "RATE_PLAN_DEFAULT_AMBIGUOUS", path: "ratePlans", message: "Должен существовать ровно один тариф по умолчанию" });
  for (const plan of snapshot.ratePlans.filter((candidate) => !candidate.archived)) {
    if (plan.pricingBasis !== "per_night") issues.push({ code: "RATE_PLAN_BASIS_UNSUPPORTED", path: `ratePlans.${plan.id}.pricingBasis`, message: "Домик в первом срезе поддерживает только цену за ночь" });
    if (plan.baseExtraUnitAmountMinor !== null && plan.includedQuantity === null) {
      issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.includedQuantity`, message: "Для доплаты за гостя требуется включённое количество гостей" });
    }
    if (!isMinor(plan.baseAmountMinor) || (plan.baseExtraUnitAmountMinor !== null && !isMinor(plan.baseExtraUnitAmountMinor))) {
      issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}`, message: "Суммы должны быть неотрицательными целыми minor units" });
    }
    const rules = plan.rules.filter((rule) => rule.enabled && !rule.archived);
    for (const rule of rules) {
      if (rule.durationMinutes !== null) issues.push({ code: "UNSUPPORTED_PRICING_DIMENSION", path: `priceRules.${rule.id}.durationMinutes`, message: "Duration-правила не поддерживаются для домика в первом срезе" });
    }
    for (let left = 0; left < rules.length; left += 1) {
      for (let right = left + 1; right < rules.length; right += 1) {
        if (potentiallyAmbiguous(rules[left]!, rules[right]!)) issues.push({
          code: "PRICE_RULE_AMBIGUOUS",
          path: `ratePlans.${plan.id}.rules`,
          message: "Правила имеют одинаковый ранг и пересекающуюся область применения",
          ruleIds: [rules[left]!.id, rules[right]!.id],
        });
      }
    }
  }
  return deepFreeze(issues);
}

function assertQuoteInputs(snapshot: HousePricingSnapshot, request: HouseQuoteRequest, context: TrustedQuoteContext) {
  assertCommonQuoteInputs(snapshot, request, context, "house");
  if (request.units !== 1) fail("HOUSE_QUOTE_UNSUPPORTED_QUANTITY", "Один расчёт поддерживает один домик");
}

function assertCommonQuoteInputs(snapshot: HousePricingSnapshot, request: HouseQuoteRequest, context: TrustedQuoteContext, kind: "house" | "campground") {
  if (!Number.isFinite(context.calculatedAt.getTime())) fail("QUOTE_CLOCK_INVALID", "Серверное время расчёта некорректно");
  if (!Number.isSafeInteger(context.quoteTtlSeconds) || context.quoteTtlSeconds <= 0) fail("QUOTE_TTL_INVALID", "Срок действия расчёта некорректен");
  if (context.nextPricingActivationAt && (!Number.isFinite(context.nextPricingActivationAt.getTime()) || context.nextPricingActivationAt <= context.calculatedAt)) fail("QUOTE_CLOCK_INVALID", "Время следующей активации некорректно");
  if (snapshot.offering.id !== request.offeringId || snapshot.offering.kind !== kind || snapshot.offering.state !== "active") fail("OFFERING_NOT_QUOTABLE", "Предложение нельзя рассчитать");
  if (!isLocalDate(request.arrivalDate) || !isLocalDate(request.departureDate) || request.arrivalDate >= request.departureDate) fail("HOUSE_QUOTE_INVALID_PERIOD", "Некорректный период проживания");
  if (snapshot.priceBook.state !== "active") fail("PRICE_BOOK_NOT_ACTIVE", "Прайс-лист не активен");
  if (snapshot.offering.activePriceBookId !== snapshot.priceBook.id || snapshot.priceBook.offeringId !== snapshot.offering.id) fail("PRICE_BOOK_MISMATCH", "Активный прайс-лист не принадлежит предложению");
  if (snapshot.offering.businessCalendarId !== snapshot.calendar.id) fail("PRICE_BOOK_MISMATCH", "Календарь не принадлежит предложению");
  if (snapshot.calendar.state !== "active") fail("CALENDAR_NOT_ACTIVE", "Бизнес-календарь не активен");
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) fail("PRICING_TIMEZONE_MISMATCH", "Часовые пояса предложения, календаря и прайса различаются");
  if (request.currency !== snapshot.offering.currency || request.currency !== snapshot.priceBook.currency) fail("PRICING_CURRENCY_MISMATCH", "Валюта запроса не совпадает с валютой предложения");
  if (request.arrivalDate < snapshot.priceBook.validFrom || (snapshot.priceBook.validToExclusive !== null && request.departureDate > snapshot.priceBook.validToExclusive)) fail("PRICE_BOOK_COVERAGE_GAP", "Прайс-лист не покрывает весь период проживания");
}

function validateCampgroundRatePlanForQuote(plan: HouseRatePlan, request: CampgroundQuoteRequest) {
  if (plan.pricingBasis !== "per_night") fail("RATE_PLAN_BASIS_UNSUPPORTED", "Для кемпинга поддерживается только цена за ночь");
  const expectedMetric = request.salesUnit === "own_tent_pitch" ? "units" : plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null ? "guests" : null;
  if (plan.quantityMetric !== expectedMetric) fail("CAMPGROUND_QUOTE_UNSUPPORTED_QUANTITY", "Метрика цены не соответствует продаваемой единице кемпинга");
  if (request.salesUnit === "own_tent_pitch" && (plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null)) fail("CAMPGROUND_QUOTE_UNSUPPORTED_QUANTITY", "Для палаточного места используется прямая цена за место");
  if (request.salesUnit === "owned_tent" && plan.baseExtraUnitAmountMinor !== null && plan.includedQuantity === null) fail("PRICE_RULE_INVALID", "Для доплаты за гостя укажите включённое количество гостей");
  if (!isMinor(plan.baseAmountMinor)) fail("PRICE_RULE_INVALID", "Базовая сумма тарифа некорректна");
  if (!inOptionalRange(request.units, plan.minQuantity, plan.maxQuantity)) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество палаточных мест вне диапазона тарифа");
  if (plan.minDurationMinutes !== null || plan.maxDurationMinutes !== null || plan.rules.some((rule) => rule.durationMinutes !== null)) fail("UNSUPPORTED_PRICING_DIMENSION", "Duration-правила ещё не поддерживаются для кемпинга");
}

function selectRatePlan(snapshot: HousePricingSnapshot, ratePlanKey: string | null): HouseRatePlan {
  const plans = snapshot.ratePlans.filter((plan) => !plan.archived && plan.priceBookId === snapshot.priceBook.id);
  if (ratePlanKey !== null) {
    const matches = plans.filter((plan) => plan.key === ratePlanKey);
    if (matches.length !== 1) fail("RATE_PLAN_NOT_FOUND", "Тариф не найден");
    return matches[0]!;
  }
  const defaults = plans.filter((plan) => plan.isDefault);
  if (defaults.length !== 1) fail("RATE_PLAN_DEFAULT_AMBIGUOUS", "Не определён единственный тариф по умолчанию");
  return defaults[0]!;
}

function validateRatePlanForQuote(plan: HouseRatePlan, guests: number | null) {
  if (plan.pricingBasis !== "per_night") fail("RATE_PLAN_BASIS_UNSUPPORTED", "Для домика поддерживается только цена за ночь");
  if (plan.quantityMetric !== null && plan.quantityMetric !== "guests") fail("HOUSE_QUOTE_UNSUPPORTED_QUANTITY", "Тариф домика может учитывать только гостей");
  if (!isMinor(plan.baseAmountMinor)) fail("PRICE_RULE_INVALID", "Базовая сумма тарифа некорректна");
  if (plan.baseExtraUnitAmountMinor !== null && (plan.includedQuantity === null || !isMinor(plan.baseExtraUnitAmountMinor))) fail("PRICE_RULE_INVALID", "Доплата за гостя настроена некорректно");
  const requiresGuests = plan.quantityMetric === "guests" || plan.minQuantity !== null || plan.maxQuantity !== null || plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null || plan.rules.some((rule) => rule.enabled && !rule.archived && rule.quantityRange !== null);
  if (requiresGuests && guests === null) fail("PRICE_QUANTITY_REQUIRED", "Для тарифа требуется количество гостей");
  if (guests !== null && (!Number.isSafeInteger(guests) || guests < 0 || !inOptionalRange(guests, plan.minQuantity, plan.maxQuantity))) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество гостей вне диапазона тарифа");
  if (plan.minDurationMinutes !== null || plan.maxDurationMinutes !== null || plan.rules.some((rule) => rule.durationMinutes !== null)) fail("UNSUPPORTED_PRICING_DIMENSION", "Duration-правила ещё не поддерживаются для домика");
}

function calculateNight(snapshot: HousePricingSnapshot, plan: HouseRatePlan, request: HouseQuoteRequest, date: LocalDate, leadDays: number, calendarByDate: ReadonlyMap<string, HouseCalendarDate>): HouseQuoteLine {
  const calendarDate = calendarByDate.get(date);
  if (!calendarDate) fail("CALENDAR_DATE_MISSING", `Дата ${date} отсутствует в производственном календаре`);
  const effectiveClass = calendarDate.activeOverride?.dayClass ?? calendarDate.official.dayClass;
  const matching = plan.rules.filter((rule) => rule.enabled && !rule.archived && matchesRule(rule, date, effectiveClass, request.guests, leadDays));
  const ranked = matching.map((rule) => ({ rule, rank: ruleRank(rule) })).sort((a, b) => compareRank(b.rank, a.rank));
  if (ranked.length > 1 && compareRank(ranked[0]!.rank, ranked[1]!.rank) === 0) fail("PRICE_RULE_AMBIGUOUS", `Для даты ${date} найдено несколько правил одинакового ранга`, { ruleIds: [ranked[0]!.rule.id, ranked[1]!.rule.id], serviceDate: date });
  const rule = ranked[0]?.rule ?? null;
  const baseAmountMinor = rule?.amountMinor ?? plan.baseAmountMinor;
  const extraUnitAmountMinor = rule?.extraUnitAmountMinor ?? plan.baseExtraUnitAmountMinor ?? 0;
  if (!isMinor(baseAmountMinor) || !isMinor(extraUnitAmountMinor)) fail("PRICE_RULE_INVALID", "Правило содержит некорректную сумму");
  const extraGuestCount = request.guests !== null && plan.includedQuantity !== null ? Math.max(0, request.guests - plan.includedQuantity) : 0;
  const extraGuestAmountMinor = safeMultiply(extraGuestCount, extraUnitAmountMinor);
  const totalAmountMinor = safeSum([baseAmountMinor, extraGuestAmountMinor]);
  return deepFreeze({
    serviceDate: date,
    baseAmountMinor,
    extraGuestCount,
    extraGuestAmountMinor,
    totalAmountMinor,
    ratePlan: { id: plan.id, version: plan.version, key: plan.key },
    matchedRule: rule ? { id: rule.id, version: rule.version, selector: rule.dateSelector, priority: rule.priority } : null,
    calendar: {
      id: snapshot.calendar.id,
      version: snapshot.calendar.version,
      sourceVersion: snapshot.calendar.sourceVersion,
      officialDateId: calendarDate.official.id,
      officialDateVersion: calendarDate.official.version,
      overrideId: calendarDate.activeOverride?.id ?? null,
      overrideVersion: calendarDate.activeOverride?.version ?? null,
      effectiveClass,
    },
  });
}

function calculateCampgroundNight(snapshot: HousePricingSnapshot, plan: HouseRatePlan, request: CampgroundQuoteRequest, date: LocalDate, leadDays: number, calendarByDate: ReadonlyMap<string, HouseCalendarDate>): HouseQuoteLine {
  const calendarDate = calendarByDate.get(date);
  if (!calendarDate) fail("CALENDAR_DATE_MISSING", `Дата ${date} отсутствует в производственном календаре`);
  const effectiveClass = calendarDate.activeOverride?.dayClass ?? calendarDate.official.dayClass;
  const quotedQuantity = request.salesUnit === "owned_tent" ? request.guests : request.units;
  const matching = plan.rules.filter((rule) => rule.enabled && !rule.archived && matchesRule(rule, date, effectiveClass, quotedQuantity, leadDays));
  const ranked = matching.map((rule) => ({ rule, rank: ruleRank(rule) })).sort((a, b) => compareRank(b.rank, a.rank));
  if (ranked.length > 1 && compareRank(ranked[0]!.rank, ranked[1]!.rank) === 0) fail("PRICE_RULE_AMBIGUOUS", `Для даты ${date} найдено несколько правил одинакового ранга`, { ruleIds: [ranked[0]!.rule.id, ranked[1]!.rule.id], serviceDate: date });
  const rule = ranked[0]?.rule ?? null;
  const unitAmountMinor = rule?.amountMinor ?? plan.baseAmountMinor;
  const extraUnitAmountMinor = rule?.extraUnitAmountMinor ?? plan.baseExtraUnitAmountMinor ?? 0;
  if (!isMinor(unitAmountMinor) || !isMinor(extraUnitAmountMinor)) fail("PRICE_RULE_INVALID", "Правило содержит некорректную сумму");
  const extraGuestCount = request.salesUnit === "owned_tent" && request.guests !== null && plan.includedQuantity !== null ? Math.max(0, request.guests - plan.includedQuantity) : 0;
  const extraGuestAmountMinor = safeMultiply(extraGuestCount, extraUnitAmountMinor);
  const totalAmountMinor = request.salesUnit === "own_tent_pitch" ? safeMultiply(request.units, unitAmountMinor) : safeSum([unitAmountMinor, extraGuestAmountMinor]);
  return deepFreeze({
    serviceDate: date,
    baseAmountMinor: totalAmountMinor,
    extraGuestCount,
    extraGuestAmountMinor,
    totalAmountMinor,
    ratePlan: { id: plan.id, version: plan.version, key: plan.key },
    matchedRule: rule ? { id: rule.id, version: rule.version, selector: rule.dateSelector, priority: rule.priority } : null,
    calendar: {
      id: snapshot.calendar.id,
      version: snapshot.calendar.version,
      sourceVersion: snapshot.calendar.sourceVersion,
      officialDateId: calendarDate.official.id,
      officialDateVersion: calendarDate.official.version,
      overrideId: calendarDate.activeOverride?.id ?? null,
      overrideVersion: calendarDate.activeOverride?.version ?? null,
      effectiveClass,
    },
  });
}

function matchesRule(rule: HousePriceRule, date: LocalDate, dayClass: HouseDayClass, guests: number | null, leadDays: number) {
  if (rule.durationMinutes !== null) return false;
  if (!matchesDate(rule.dateSelector, date, dayClass)) return false;
  if (rule.quantityRange !== null && (guests === null || !inRange(guests, rule.quantityRange))) return false;
  return rule.bookingLeadDays === null || inRange(leadDays, rule.bookingLeadDays);
}

function matchesDate(selector: HouseDateSelector, date: LocalDate, dayClass: HouseDayClass) {
  switch (selector.type) {
    case "custom_date_override": return selector.from <= date && date < selector.toExclusive;
    case "calendar_holiday": return dayClass === "holiday";
    case "recurring_weekdays": return selector.days.includes(weekdayFor(date));
    case "day_class": return dayClass === selector.dayClass;
    case "any_date": return true;
  }
}

function ruleRank(rule: HousePriceRule): readonly [number, number, number] {
  const dateRank = rule.dateSelector.type === "custom_date_override" ? 4 : rule.dateSelector.type === "calendar_holiday" ? 3 : rule.dateSelector.type === "day_class" || rule.dateSelector.type === "recurring_weekdays" ? 2 : 1;
  return [dateRank, Number(rule.quantityRange !== null) + Number(rule.bookingLeadDays !== null) + Number(rule.durationMinutes !== null), rule.priority];
}

function compareRank(left: readonly number[], right: readonly number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function potentiallyAmbiguous(left: HousePriceRule, right: HousePriceRule) {
  return compareRank(ruleRank(left), ruleRank(right)) === 0
    && dateSelectorsOverlap(left.dateSelector, right.dateSelector)
    && optionalRangesOverlap(left.quantityRange, right.quantityRange)
    && optionalRangesOverlap(left.bookingLeadDays, right.bookingLeadDays)
    && optionalRangesOverlap(left.durationMinutes, right.durationMinutes);
}

function dateSelectorsOverlap(left: HouseDateSelector, right: HouseDateSelector) {
  if (left.type !== right.type) return false;
  if (left.type === "custom_date_override" && right.type === "custom_date_override") return left.from < right.toExclusive && right.from < left.toExclusive;
  if (left.type === "day_class" && right.type === "day_class") return left.dayClass === right.dayClass;
  if (left.type === "recurring_weekdays" && right.type === "recurring_weekdays") return left.days.some((day) => right.days.includes(day));
  return true;
}

function weekdayFor(date: LocalDate): PricingWeekday {
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[new Date(`${date}T00:00:00.000Z`).getUTCDay()]!;
}

function optionalRangesOverlap(left: HouseInclusiveRange | null, right: HouseInclusiveRange | null) {
  const leftMin = left?.min ?? Number.NEGATIVE_INFINITY;
  const rightMin = right?.min ?? Number.NEGATIVE_INFINITY;
  const leftMax = left?.max ?? Number.POSITIVE_INFINITY;
  const rightMax = right?.max ?? Number.POSITIVE_INFINITY;
  return leftMin <= rightMax && rightMin <= leftMax;
}

function uniqueCalendarDates(dates: readonly HouseCalendarDate[]) {
  const result = new Map<string, HouseCalendarDate>();
  for (const day of dates) {
    if (result.has(day.date)) fail("CALENDAR_DATE_AMBIGUOUS", `Для даты ${day.date} найдено несколько календарных записей`);
    result.set(day.date, day);
  }
  return result;
}

function isLocalDate(value: string) {
  if (!localDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function enumerateDates(from: LocalDate, toExclusive: LocalDate) {
  const result: LocalDate[] = [];
  for (let cursor = from; cursor < toExclusive; cursor = addDays(cursor, 1)) result.push(cursor);
  return result;
}

function addDays(value: LocalDate, amount: number) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function daysBetween(from: LocalDate, to: LocalDate) {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function localDateInTimeZone(value: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const part = (type: "year" | "month" | "day") => parts.find((candidate) => candidate.type === type)?.value;
    const result = `${part("year")}-${part("month")}-${part("day")}`;
    if (!isLocalDate(result)) throw new Error("invalid local date");
    return result;
  } catch {
    fail("PRICING_TIMEZONE_MISMATCH", "Часовой пояс предложения некорректен");
  }
}

function inRange(value: number, range: HouseInclusiveRange) {
  return value >= range.min && (range.max === null || value <= range.max);
}

function inOptionalRange(value: number, min: number | null, max: number | null) {
  return (min === null || value >= min) && (max === null || value <= max);
}

function isMinor(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function safeMultiply(left: number, right: number) {
  const result = left * right;
  if (!Number.isSafeInteger(result) || result < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта превышает безопасный диапазон");
  return result;
}

function safeSum(values: readonly number[]) {
  return values.reduce((total, value) => {
    const result = total + value;
    if (!Number.isSafeInteger(result) || result < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта превышает безопасный диапазон");
    return result;
  }, 0);
}

function fail(code: DomainError["code"], message: string, details: Record<string, unknown> = {}): never {
  throw new DomainError(code, message, { details });
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
