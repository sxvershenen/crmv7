import { DomainError } from "./errors.js";
import type {
  HouseDateSelector,
  HouseDayClass,
  HouseInclusiveRange,
  HousePriceRule,
  HouseRatePlan,
  PricingWeekday,
  TrustedQuoteContext,
} from "./offering-pricing.js";

export interface EventServiceTemplatePricingTerms {
  readonly id: string;
  readonly version: number;
  readonly defaultDurationMinutes: number;
  readonly minimumGuests: number | null;
  readonly maximumGuests: number | null;
  readonly preparationBeforeMinutes: number;
  readonly preparationAfterMinutes: number;
}

export interface EventServicePricingSnapshot {
  readonly offering: Readonly<{
    id: string;
    version: number;
    subjectVersion: number;
    pricingVersion: number;
    addOnAssignmentsVersion: number;
    kind: string;
    state: string;
    currency: string;
    timezone: string;
    businessCalendarId: string;
    activePriceBookId: string | null;
  }>;
  readonly template: EventServiceTemplatePricingTerms;
  readonly priceBook: Readonly<{
    id: string;
    version: number;
    revision: number;
    offeringId: string;
    state: string;
    currency: string;
    timezone: string;
    validFrom: string;
    validToExclusive: string | null;
  }>;
  readonly ratePlans: readonly HouseRatePlan[];
  readonly calendar: Readonly<{
    id: string;
    version: number;
    state: string;
    timezone: string;
    sourceVersion: string;
    dates: readonly Readonly<{
      date: string;
      official: Readonly<{ id: string; version: number; dayClass: HouseDayClass; sourceVersion: string }>;
      activeOverride: Readonly<{ id: string; version: number; dayClass: HouseDayClass; reason: string }> | null;
    }>[];
  }>;
}

export interface EventServiceQuoteRequest {
  readonly offeringId: string;
  readonly eventServiceTemplateId: string;
  readonly ratePlanKey: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly guests: number;
  readonly currency: string;
}

export interface EventServiceQuoteLine {
  readonly kind: "base" | "extra_unit";
  readonly quantity: number;
  readonly unitAmountMinor: number;
  readonly totalAmountMinor: number;
  readonly ratePlan: Readonly<{ id: string; version: number; key: string }>;
  readonly matchedRule: Readonly<{ id: string; version: number; selector: HouseDateSelector; priority: number }> | null;
}

export interface EventServiceQuoteCalculation {
  readonly quoteType: "event_service_preview";
  readonly acceptanceReady: false;
  readonly quoteId: string;
  readonly input: EventServiceQuoteRequest;
  readonly offeringId: string;
  readonly eventServiceTemplateId: string;
  readonly offeringVersion: number;
  readonly subjectVersion: number;
  readonly eventServiceTemplateVersion: number;
  readonly pricingVersion: number;
  readonly addOnAssignmentsVersion: number;
  readonly priceBookId: string;
  readonly priceBookVersion: number;
  readonly priceBookRevision: number;
  readonly calendarId: string;
  readonly calendarVersion: number;
  readonly calendarSourceVersion: string;
  readonly calendarDateId: string;
  readonly calendarDateVersion: number;
  readonly calendarDateOverrideId: string | null;
  readonly calendarDateOverrideVersion: number | null;
  readonly calculatedAt: string;
  readonly serviceDate: string;
  readonly durationMinutes: number;
  readonly leadDays: number;
  readonly validUntil: string;
  readonly currency: string;
  readonly timezone: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly preparationBeforeMinutes: number;
  readonly preparationAfterMinutes: number;
  readonly preparationStartsAt: string;
  readonly preparationEndsAt: string;
  readonly lines: readonly EventServiceQuoteLine[];
  readonly totalAmountMinor: number;
  readonly immutableSnapshot: true;
}

export interface EventServicePricingValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly ruleIds?: readonly string[];
}

export interface EventServicePricingCoverageWindow {
  readonly from: string;
  readonly toExclusive: string;
}

type EventServicePricingActivationSnapshot = Omit<EventServicePricingSnapshot, "template"> & Readonly<{
  template: Omit<EventServiceTemplatePricingTerms, "preparationBeforeMinutes" | "preparationAfterMinutes">;
}>;

export function resolveEventServiceQuote(
  snapshot: EventServicePricingSnapshot,
  request: EventServiceQuoteRequest,
  context: TrustedQuoteContext,
): EventServiceQuoteCalculation {
  assertQuoteInputs(snapshot, request, context);
  const startsAt = parseInstant(request.startsAt);
  const endsAt = parseInstant(request.endsAt);
  if (startsAt >= endsAt) fail("EVENT_INTERVAL_INVALID", "Интервал мероприятия должен быть положительным");
  const serviceDate = localDateInTimeZone(startsAt, snapshot.offering.timezone);
  const endServiceDate = localDateInTimeZone(endsAt, snapshot.offering.timezone);
  if (serviceDate !== endServiceDate) fail("EVENT_INTERVAL_CROSSES_LOCAL_DATE", "Интервал мероприятия должен находиться в одном локальном дне");
  if (serviceDate < snapshot.priceBook.validFrom || snapshot.priceBook.validToExclusive !== null && serviceDate >= snapshot.priceBook.validToExclusive) {
    fail("PRICE_BOOK_COVERAGE_GAP", "Дата мероприятия не входит в период действия прайс-листа");
  }
  const durationMilliseconds = endsAt.getTime() - startsAt.getTime();
  if (durationMilliseconds % 60_000 !== 0) fail("EVENT_INTERVAL_INVALID", "Длительность мероприятия должна быть целым числом минут");
  const durationMinutes = durationMilliseconds / 60_000;
  const leadDays = daysBetween(localDateInTimeZone(context.calculatedAt, snapshot.offering.timezone), serviceDate);
  if (leadDays < 0) fail("QUOTE_SERVICE_DATE_IN_PAST", "Дата мероприятия уже прошла");

  const plan = selectRatePlan(snapshot, request.ratePlanKey);
  validatePlan(plan, snapshot.template, request.guests, durationMinutes);
  const calendarDate = uniqueCalendarDates(snapshot.calendar.dates).get(serviceDate);
  if (!calendarDate) fail("CALENDAR_DATE_MISSING", `Дата ${serviceDate} отсутствует в производственном календаре`);
  const effectiveClass = calendarDate.activeOverride?.dayClass ?? calendarDate.official.dayClass;
  const matching = plan.rules
    .filter((rule) => rule.enabled && !rule.archived && matchesRule(rule, serviceDate, effectiveClass, request.guests, leadDays, durationMinutes))
    .map((rule) => ({ rule, rank: ruleRank(rule) }))
    .sort((left, right) => compareRank(right.rank, left.rank));
  if (matching.length > 1 && compareRank(matching[0]!.rank, matching[1]!.rank) === 0) {
    fail("PRICE_RULE_AMBIGUOUS", "Для мероприятия найдено несколько правил одинакового ранга", { ruleIds: [matching[0]!.rule.id, matching[1]!.rule.id] });
  }
  const rule = matching[0]?.rule ?? null;
  const amount = rule?.amountMinor ?? plan.baseAmountMinor;
  const extraAmount = rule?.extraUnitAmountMinor ?? plan.baseExtraUnitAmountMinor;
  if (!isMinor(amount) || (extraAmount !== null && !isMinor(extraAmount))) fail("PRICE_RULE_INVALID", "Цена мероприятия должна быть задана в minor units");
  const ratePlan = { id: plan.id, version: plan.version, key: plan.key };
  const matchedRule = rule ? { id: rule.id, version: rule.version, selector: rule.dateSelector, priority: rule.priority } : null;
  const lines: EventServiceQuoteLine[] = [{ kind: "base", quantity: 1, unitAmountMinor: amount, totalAmountMinor: amount, ratePlan, matchedRule }];
  const included = plan.includedQuantity!;
  if (request.guests > included) {
    if (extraAmount === null) fail("EVENT_PACKAGE_EXTRA_UNSUPPORTED", "Пакет не содержит доплату за гостей сверх включённого лимита");
    const quantity = request.guests - included;
    lines.push({ kind: "extra_unit", quantity, unitAmountMinor: extraAmount, totalAmountMinor: safeMultiply(extraAmount, quantity), ratePlan, matchedRule });
  }
  const ttlEnd = new Date(context.calculatedAt.getTime() + context.quoteTtlSeconds * 1000);
  const nextMidnight = nextLocalMidnight(context.calculatedAt, snapshot.offering.timezone);
  const scheduledCap = context.nextPricingActivationAt && context.nextPricingActivationAt < ttlEnd ? context.nextPricingActivationAt : ttlEnd;
  const validUntil = nextMidnight < scheduledCap ? nextMidnight : scheduledCap;
  const preparationStartsAt = new Date(startsAt.getTime() - snapshot.template.preparationBeforeMinutes * 60_000);
  const preparationEndsAt = new Date(endsAt.getTime() + snapshot.template.preparationAfterMinutes * 60_000);
  return deepFreeze({
    quoteType: "event_service_preview" as const,
    acceptanceReady: false as const,
    quoteId: context.quoteId,
    input: { ...request },
    offeringId: snapshot.offering.id,
    eventServiceTemplateId: snapshot.template.id,
    offeringVersion: snapshot.offering.version,
    subjectVersion: snapshot.offering.subjectVersion,
    eventServiceTemplateVersion: snapshot.template.version,
    pricingVersion: snapshot.offering.pricingVersion,
    addOnAssignmentsVersion: snapshot.offering.addOnAssignmentsVersion,
    priceBookId: snapshot.priceBook.id,
    priceBookVersion: snapshot.priceBook.version,
    priceBookRevision: snapshot.priceBook.revision,
    calendarId: snapshot.calendar.id,
    calendarVersion: snapshot.calendar.version,
    calendarSourceVersion: snapshot.calendar.sourceVersion,
    calendarDateId: calendarDate.official.id,
    calendarDateVersion: calendarDate.official.version,
    calendarDateOverrideId: calendarDate.activeOverride?.id ?? null,
    calendarDateOverrideVersion: calendarDate.activeOverride?.version ?? null,
    calculatedAt: context.calculatedAt.toISOString(),
    serviceDate,
    durationMinutes,
    leadDays,
    validUntil: validUntil.toISOString(),
    currency: request.currency,
    timezone: snapshot.offering.timezone,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    preparationBeforeMinutes: snapshot.template.preparationBeforeMinutes,
    preparationAfterMinutes: snapshot.template.preparationAfterMinutes,
    preparationStartsAt: preparationStartsAt.toISOString(),
    preparationEndsAt: preparationEndsAt.toISOString(),
    lines,
    totalAmountMinor: safeSum(lines.map((line) => line.totalAmountMinor)),
    immutableSnapshot: true as const,
  });
}

export function validateEventServicePricingForActivation(
  snapshot: EventServicePricingActivationSnapshot,
  coverageWindow: EventServicePricingCoverageWindow,
): readonly EventServicePricingValidationIssue[] {
  const issues: EventServicePricingValidationIssue[] = [];
  if (!isLocalDate(coverageWindow.from) || !isLocalDate(coverageWindow.toExclusive) || coverageWindow.from >= coverageWindow.toExclusive) {
    return [{ code: "INVALID_COVERAGE_WINDOW", path: "coverageWindow", message: "Некорректное окно проверки" }];
  }
  if (snapshot.template.defaultDurationMinutes <= 0 || (snapshot.template.minimumGuests !== null && snapshot.template.maximumGuests !== null && snapshot.template.minimumGuests > snapshot.template.maximumGuests)) {
    issues.push({ code: "EVENT_SERVICE_TEMPLATE_INVALID", path: "template", message: "Шаблон мероприятия содержит некорректные duration/guest bounds" });
  }
  if (snapshot.offering.currency !== snapshot.priceBook.currency) issues.push({ code: "PRICING_CURRENCY_MISMATCH", path: "currency", message: "Валюты предложения и прайса различаются" });
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) issues.push({ code: "PRICING_TIMEZONE_MISMATCH", path: "timezone", message: "Часовые пояса предложения, календаря и прайса различаются" });
  if (snapshot.calendar.state !== "active") issues.push({ code: "CALENDAR_NOT_ACTIVE", path: "calendar.state", message: "Бизнес-календарь не активен" });
  const dates = new Set(snapshot.calendar.dates.map((day) => day.date));
  for (const date of enumerateDates(coverageWindow.from, coverageWindow.toExclusive)) if (!dates.has(date)) issues.push({ code: "CALENDAR_DATE_MISSING", path: `calendar.dates.${date}`, message: "Дата отсутствует в производственном календаре" });
  const plans = snapshot.ratePlans.filter((plan) => !plan.archived);
  if (plans.filter((plan) => plan.isDefault).length !== 1) issues.push({ code: "RATE_PLAN_DEFAULT_AMBIGUOUS", path: "ratePlans", message: "Должен существовать ровно один тариф по умолчанию" });
  for (const plan of plans) {
    if (plan.pricingBasis !== "flat_package") issues.push({ code: "RATE_PLAN_BASIS_UNSUPPORTED", path: `ratePlans.${plan.id}.pricingBasis`, message: "Мероприятие поддерживает только flat_package" });
    if (plan.quantityMetric !== "guests") issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.quantityMetric`, message: "Тариф мероприятия использует quantityMetric=guests" });
    if (plan.includedQuantity === null) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.includedQuantity`, message: "Пакет мероприятия требует включённый лимит гостей" });
    if (plan.minQuantity !== null && plan.maxQuantity !== null && plan.minQuantity > plan.maxQuantity) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.quantityRange`, message: "Некорректный диапазон гостей тарифа" });
    if (plan.minDurationMinutes !== null && plan.maxDurationMinutes !== null && plan.minDurationMinutes > plan.maxDurationMinutes) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.durationRange`, message: "Некорректный диапазон длительности тарифа" });
    if (plan.baseExtraUnitAmountMinor !== null && plan.includedQuantity === null) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.baseExtraUnitAmountMinor`, message: "Доплата требует включённый лимит гостей" });
    if (!isMinor(plan.baseAmountMinor) || (plan.baseExtraUnitAmountMinor !== null && !isMinor(plan.baseExtraUnitAmountMinor))) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}`, message: "Суммы должны быть неотрицательными целыми minor units" });
    const rules = plan.rules.filter((rule) => rule.enabled && !rule.archived);
    for (let left = 0; left < rules.length; left += 1) for (let right = left + 1; right < rules.length; right += 1) {
      if (potentiallyAmbiguous(rules[left]!, rules[right]!)) issues.push({ code: "PRICE_RULE_AMBIGUOUS", path: `ratePlans.${plan.id}.rules`, message: "Правила имеют одинаковый ранг и пересекаются", ruleIds: [rules[left]!.id, rules[right]!.id] });
    }
  }
  return deepFreeze(issues);
}

function assertQuoteInputs(snapshot: EventServicePricingSnapshot, request: EventServiceQuoteRequest, context: TrustedQuoteContext) {
  if (!Number.isFinite(context.calculatedAt.getTime())) fail("QUOTE_CLOCK_INVALID", "Серверное время расчёта некорректно");
  if (!Number.isSafeInteger(context.quoteTtlSeconds) || context.quoteTtlSeconds <= 0) fail("QUOTE_TTL_INVALID", "Срок действия расчёта некорректен");
  if (context.nextPricingActivationAt && (!Number.isFinite(context.nextPricingActivationAt.getTime()) || context.nextPricingActivationAt <= context.calculatedAt)) fail("QUOTE_CLOCK_INVALID", "Время следующей активации некорректно");
  if (snapshot.offering.id !== request.offeringId || snapshot.offering.kind !== "event_service" || snapshot.offering.state !== "active") fail("OFFERING_NOT_QUOTABLE", "Формат мероприятия нельзя рассчитать");
  if (snapshot.template.id !== request.eventServiceTemplateId) fail("EVENT_SERVICE_TEMPLATE_MISMATCH", "Шаблон мероприятия не соответствует предложению");
  if (!hasOffset(request.startsAt) || !hasOffset(request.endsAt)) fail("EVENT_INTERVAL_INVALID", "Время мероприятия должно содержать offset");
  if (!Number.isSafeInteger(request.guests) || request.guests <= 0) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество гостей должно быть положительным");
  if (snapshot.priceBook.state !== "active") fail("PRICE_BOOK_NOT_ACTIVE", "Прайс-лист мероприятия не активен");
  if (snapshot.offering.activePriceBookId !== snapshot.priceBook.id || snapshot.priceBook.offeringId !== snapshot.offering.id) fail("PRICE_BOOK_MISMATCH", "Активный прайс-лист не принадлежит предложению");
  if (snapshot.offering.businessCalendarId !== snapshot.calendar.id) fail("PRICE_BOOK_MISMATCH", "Календарь не принадлежит предложению");
  if (snapshot.calendar.state !== "active") fail("CALENDAR_NOT_ACTIVE", "Календарь мероприятия не активен");
  if (request.currency !== snapshot.offering.currency || request.currency !== snapshot.priceBook.currency) fail("PRICING_CURRENCY_MISMATCH", "Валюта запроса не совпадает с валютой предложения");
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) fail("PRICING_TIMEZONE_MISMATCH", "Часовые пояса предложения, прайса и календаря различаются");
}

function validatePlan(plan: HouseRatePlan, template: EventServiceTemplatePricingTerms, guests: number, durationMinutes: number) {
  if (plan.pricingBasis !== "flat_package") fail("RATE_PLAN_BASIS_UNSUPPORTED", "Для мероприятия поддерживается только flat_package");
  if (plan.quantityMetric !== "guests" || plan.includedQuantity === null) fail("PRICE_RULE_INVALID", "Тариф мероприятия должен использовать guests и includedQuantity");
  if (template.minimumGuests !== null && guests < template.minimumGuests || template.maximumGuests !== null && guests > template.maximumGuests) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество гостей вне лимитов шаблона");
  if (plan.minQuantity !== null && guests < plan.minQuantity || plan.maxQuantity !== null && guests > plan.maxQuantity) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество гостей вне лимитов тарифа");
  const hasDurationBounds = plan.minDurationMinutes !== null || plan.maxDurationMinutes !== null;
  if (!hasDurationBounds && durationMinutes !== template.defaultDurationMinutes) fail("EVENT_DURATION_OUT_OF_RANGE", "Без bounds длительность должна совпадать с длительностью шаблона");
  if (plan.minDurationMinutes !== null && durationMinutes < plan.minDurationMinutes || plan.maxDurationMinutes !== null && durationMinutes > plan.maxDurationMinutes) fail("EVENT_DURATION_OUT_OF_RANGE", "Длительность не входит в диапазон тарифа");
  if (!isMinor(plan.baseAmountMinor) || (plan.baseExtraUnitAmountMinor !== null && !isMinor(plan.baseExtraUnitAmountMinor))) fail("PRICE_RULE_INVALID", "Базовая сумма тарифа некорректна");
}

function selectRatePlan(snapshot: EventServicePricingSnapshot, key: string) {
  const plans = snapshot.ratePlans.filter((plan) => !plan.archived && plan.priceBookId === snapshot.priceBook.id && plan.key === key);
  if (plans.length !== 1) fail("RATE_PLAN_NOT_FOUND", "Именованный тариф мероприятия не найден однозначно");
  return plans[0]!;
}

function matchesRule(rule: HousePriceRule, date: string, dayClass: HouseDayClass, guests: number, leadDays: number, durationMinutes: number) {
  return matchesDate(rule.dateSelector, date, dayClass) && inRange(guests, rule.quantityRange) && inRange(leadDays, rule.bookingLeadDays) && inRange(durationMinutes, rule.durationMinutes);
}

function matchesDate(selector: HouseDateSelector, date: string, dayClass: HouseDayClass) {
  return selector.type === "any_date"
    || selector.type === "custom_date_override" && date >= selector.from && date < selector.toExclusive
    || selector.type === "calendar_holiday" && dayClass === "holiday"
    || selector.type === "day_class" && selector.dayClass === dayClass
    || selector.type === "recurring_weekdays" && selector.days.includes(weekday(date));
}

function ruleRank(rule: HousePriceRule): readonly [number, number, number] {
  const dateRank = rule.dateSelector.type === "custom_date_override" ? 4 : rule.dateSelector.type === "calendar_holiday" ? 3 : rule.dateSelector.type === "day_class" || rule.dateSelector.type === "recurring_weekdays" ? 2 : 1;
  return [dateRank, Number(rule.quantityRange !== null) + Number(rule.bookingLeadDays !== null) + Number(rule.durationMinutes !== null), rule.priority];
}
function compareRank(left: readonly number[], right: readonly number[]) { for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index]! - right[index]!; return 0; }
function potentiallyAmbiguous(left: HousePriceRule, right: HousePriceRule) { return compareRank(ruleRank(left), ruleRank(right)) === 0 && selectorsOverlap(left.dateSelector, right.dateSelector) && rangesOverlap(left.quantityRange, right.quantityRange) && rangesOverlap(left.bookingLeadDays, right.bookingLeadDays) && rangesOverlap(left.durationMinutes, right.durationMinutes); }
function selectorsOverlap(left: HouseDateSelector, right: HouseDateSelector) {
  if (left.type === "custom_date_override" && right.type === "custom_date_override") return left.from < right.toExclusive && right.from < left.toExclusive;
  if (left.type === "day_class" && right.type === "day_class") return left.dayClass === right.dayClass;
  if (left.type === "recurring_weekdays" && right.type === "recurring_weekdays") return left.days.some((day) => right.days.includes(day));
  if (left.type === "day_class" && right.type === "recurring_weekdays" || left.type === "recurring_weekdays" && right.type === "day_class") return true;
  return left.type === right.type || left.type === "any_date" || right.type === "any_date";
}
function rangesOverlap(left: HouseInclusiveRange | null, right: HouseInclusiveRange | null) { return left === null || right === null || left.min <= (right.max ?? Number.POSITIVE_INFINITY) && right.min <= (left.max ?? Number.POSITIVE_INFINITY); }
function inRange(value: number, range: HouseInclusiveRange | null) { return range === null || value >= range.min && (range.max === null || value <= range.max); }
function uniqueCalendarDates(dates: EventServicePricingSnapshot["calendar"]["dates"]) { const result = new Map<string, EventServicePricingSnapshot["calendar"]["dates"][number]>(); for (const date of dates) { if (result.has(date.date)) fail("CALENDAR_DATE_AMBIGUOUS", `Для даты ${date.date} найдено несколько календарных записей`); result.set(date.date, date); } return result; }
function enumerateDates(from: string, toExclusive: string) { const result: string[] = []; for (let date = from; date < toExclusive; date = new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)) result.push(date); return result; }
function isLocalDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value; }
function parseInstant(value: string) { const instant = new Date(value); if (!hasOffset(value) || !Number.isFinite(instant.getTime())) fail("EVENT_INTERVAL_INVALID", "Время мероприятия некорректно"); return instant; }
function hasOffset(value: string) { return /(?:Z|[+-]\d{2}:\d{2})$/.test(value); }
function localDateInTimeZone(value: Date, timezone: string) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value); } catch { fail("PRICING_TIMEZONE_MISMATCH", "Часовой пояс мероприятия некорректен"); } }
function nextLocalMidnight(value: Date, timezone: string) {
  const nextDate = new Date(`${localDateInTimeZone(value, timezone)}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const target = Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate());
  let candidate = target;
  try {
    const formatter = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const parts = formatter.formatToParts(new Date(candidate));
      const part = (type: "year" | "month" | "day" | "hour" | "minute" | "second") => Number(parts.find((item) => item.type === type)?.value);
      const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
      candidate += target - represented;
    }
  } catch {
    fail("PRICING_TIMEZONE_MISMATCH", "Часовой пояс мероприятия некорректен");
  }
  const result = new Date(candidate);
  if (!Number.isFinite(result.getTime()) || result <= value) fail("QUOTE_CLOCK_INVALID", "Не удалось определить ближайшую смену локального дня");
  return result;
}
function daysBetween(from: string, to: string) { return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000); }
function weekday(date: string) { return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[new Date(`${date}T00:00:00.000Z`).getUTCDay()] as PricingWeekday; }
function isMinor(value: number) { return Number.isSafeInteger(value) && value >= 0; }
function safeMultiply(left: number, right: number) { const value = left * right; if (!Number.isSafeInteger(value) || value < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта слишком велика"); return value; }
function safeSum(values: readonly number[]) { return values.reduce((sum, value) => safeAdd(sum, value), 0); }
function safeAdd(left: number, right: number) { const value = left + right; if (!Number.isSafeInteger(value) || value < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта слишком велика"); return value; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
function fail(code: DomainError["code"], message: string, details: Record<string, unknown> = {}): never { throw new DomainError(code, message, { details }); }
