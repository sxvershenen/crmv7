import { DomainError } from "./errors.js";
import type { HouseDateSelector, HousePricingSnapshot, HouseRatePlan, HousePriceRule, TrustedQuoteContext } from "./offering-pricing.js";

export interface ProgramQuoteRequest {
  readonly offeringId: string;
  readonly programTemplateId: string;
  readonly ratePlanKey: string | null;
  readonly serviceDate: string;
  readonly participants: number;
  readonly durationMinutes: number;
  readonly currency: string;
}

export interface ProgramPricingSnapshot extends HousePricingSnapshot {
  readonly offering: HousePricingSnapshot["offering"] & Readonly<{ subjectVersion: number }>;
  readonly template: Readonly<{
    id: string;
    version: number;
    durationMinutes: number;
    minimumParticipants: number | null;
    participantLimit: number;
  }>;
}

export interface ProgramQuoteLine {
  readonly kind: "base" | "extra_unit";
  readonly quantity: number;
  readonly unitAmountMinor: number;
  readonly totalAmountMinor: number;
  readonly ratePlan: Readonly<{ id: string; version: number; key: string }>;
  readonly matchedRule: Readonly<{ id: string; version: number; selector: HouseDateSelector; priority: number }> | null;
}

export interface ProgramQuoteCalculation {
  readonly quoteType: "template_preview";
  readonly acceptanceReady: false;
  readonly quoteId: string;
  readonly input: ProgramQuoteRequest;
  readonly offeringId: string;
  readonly offeringVersion: number;
  readonly subjectVersion: number;
  readonly programTemplateId: string;
  readonly programTemplateVersion: number;
  readonly pricingVersion: number;
  readonly priceBookId: string;
  readonly priceBookVersion: number;
  readonly priceBookRevision: number;
  readonly calendarId: string;
  readonly calendarVersion: number;
  readonly calendarSourceVersion: string;
  readonly calculatedAt: string;
  readonly quoteLocalDate: string;
  readonly leadDays: number;
  readonly validUntil: string;
  readonly currency: string;
  readonly timezone: string;
  readonly lines: readonly ProgramQuoteLine[];
  readonly totalAmountMinor: number;
  readonly immutableSnapshot: true;
}

export interface ProgramPricingValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly ruleIds?: readonly string[];
}

export function resolveProgramTemplateQuote(snapshot: ProgramPricingSnapshot, request: ProgramQuoteRequest, context: TrustedQuoteContext): ProgramQuoteCalculation {
  assertInputs(snapshot, request, context);
  const quoteLocalDate = localDateInTimeZone(context.calculatedAt, snapshot.offering.timezone);
  const leadDays = daysBetween(quoteLocalDate, request.serviceDate);
  if (leadDays < 0) fail("QUOTE_SERVICE_DATE_IN_PAST", "Дата программы уже прошла");
  const plan = selectRatePlan(snapshot.ratePlans, request.ratePlanKey);
  validatePlan(plan, snapshot, request);
  const day = snapshot.calendar.dates.find((item) => item.date === request.serviceDate);
  if (!day) fail("CALENDAR_DATE_MISSING", `Дата ${request.serviceDate} отсутствует в производственном календаре`);
  const effectiveClass = day.activeOverride?.dayClass ?? day.official.dayClass;
  const matches = plan.rules
    .filter((rule) => rule.enabled && !rule.archived && matchesRule(rule, request.serviceDate, effectiveClass, request.participants, leadDays, request.durationMinutes))
    .map((rule) => ({ rule, rank: ruleRank(rule) }))
    .sort((left, right) => compareRank(right.rank, left.rank));
  if (matches.length > 1 && compareRank(matches[0]!.rank, matches[1]!.rank) === 0) {
    fail("PRICE_RULE_AMBIGUOUS", "Для программы найдено несколько правил одинакового ранга", { ruleIds: [matches[0]!.rule.id, matches[1]!.rule.id] });
  }
  const rule = matches[0]?.rule ?? null;
  const amount = rule?.amountMinor ?? plan.baseAmountMinor;
  const extra = rule?.extraUnitAmountMinor ?? plan.baseExtraUnitAmountMinor;
  if (!isMinor(amount) || (extra !== null && !isMinor(extra))) fail("PRICE_RULE_INVALID", "Цена программы должна быть задана в minor units");
  const ratePlan = { id: plan.id, version: plan.version, key: plan.key };
  const matchedRule = rule ? { id: rule.id, version: rule.version, selector: rule.dateSelector, priority: rule.priority } : null;
  const lines: ProgramQuoteLine[] = [];
  if (plan.pricingBasis === "per_person") {
    lines.push({ kind: "base", quantity: request.participants, unitAmountMinor: amount, totalAmountMinor: safeMultiply(amount, request.participants), ratePlan, matchedRule });
  } else {
    lines.push({ kind: "base", quantity: 1, unitAmountMinor: amount, totalAmountMinor: amount, ratePlan, matchedRule });
    if (plan.includedQuantity !== null && extra !== null && request.participants > plan.includedQuantity) {
      const quantity = request.participants - plan.includedQuantity;
      lines.push({ kind: "extra_unit", quantity, unitAmountMinor: extra, totalAmountMinor: safeMultiply(extra, quantity), ratePlan, matchedRule });
    }
  }
  const totalAmountMinor = safeSum(lines.map((line) => line.totalAmountMinor));
  const ttlEnd = new Date(context.calculatedAt.getTime() + context.quoteTtlSeconds * 1000);
  const validUntil = context.nextPricingActivationAt && context.nextPricingActivationAt < ttlEnd ? context.nextPricingActivationAt : ttlEnd;
  return deepFreeze({
    quoteType: "template_preview" as const, acceptanceReady: false as const, quoteId: context.quoteId, input: { ...request },
    offeringId: snapshot.offering.id, offeringVersion: snapshot.offering.version, subjectVersion: snapshot.offering.subjectVersion,
    programTemplateId: snapshot.template.id, programTemplateVersion: snapshot.template.version,
    pricingVersion: snapshot.offering.pricingVersion, priceBookId: snapshot.priceBook.id,
    priceBookVersion: snapshot.priceBook.version, priceBookRevision: snapshot.priceBook.revision,
    calendarId: snapshot.calendar.id, calendarVersion: snapshot.calendar.version, calendarSourceVersion: snapshot.calendar.sourceVersion,
    calculatedAt: context.calculatedAt.toISOString(), quoteLocalDate, leadDays, validUntil: validUntil.toISOString(),
    currency: request.currency, timezone: snapshot.offering.timezone, lines, totalAmountMinor, immutableSnapshot: true as const,
  });
}

export function validateProgramPricingForActivation(snapshot: ProgramPricingSnapshot, from: string, toExclusive: string): readonly ProgramPricingValidationIssue[] {
  const issues: ProgramPricingValidationIssue[] = [];
  if (!isLocalDate(from) || !isLocalDate(toExclusive) || from >= toExclusive) return [{ code: "INVALID_COVERAGE_WINDOW", path: "coverageWindow", message: "Некорректное окно проверки" }];
  if (snapshot.template.durationMinutes <= 0 || snapshot.template.participantLimit <= 0 || (snapshot.template.minimumParticipants !== null && snapshot.template.minimumParticipants > snapshot.template.participantLimit)) {
    issues.push({ code: "PROGRAM_TEMPLATE_INVALID", path: "template", message: "Шаблон программы содержит некорректные duration/capacity" });
  }
  if (snapshot.offering.currency !== snapshot.priceBook.currency) issues.push({ code: "PRICING_CURRENCY_MISMATCH", path: "currency", message: "Валюты предложения и прайса различаются" });
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) issues.push({ code: "PRICING_TIMEZONE_MISMATCH", path: "timezone", message: "Часовые пояса предложения, календаря и прайса различаются" });
  if (snapshot.calendar.state !== "active") issues.push({ code: "CALENDAR_NOT_ACTIVE", path: "calendar.state", message: "Бизнес-календарь не активен" });
  const dates = new Set(snapshot.calendar.dates.map((day) => day.date));
  for (const date of enumerateDates(from, toExclusive)) if (!dates.has(date)) issues.push({ code: "CALENDAR_DATE_MISSING", path: `calendar.dates.${date}`, message: "Дата отсутствует в производственном календаре" });
  const plans = snapshot.ratePlans.filter((plan) => !plan.archived);
  if (plans.filter((plan) => plan.isDefault).length !== 1) issues.push({ code: "RATE_PLAN_DEFAULT_AMBIGUOUS", path: "ratePlans", message: "Должен существовать ровно один тариф по умолчанию" });
  for (const plan of plans) {
    if (plan.pricingBasis !== "per_person" && plan.pricingBasis !== "flat_package") issues.push({ code: "RATE_PLAN_BASIS_UNSUPPORTED", path: `ratePlans.${plan.id}.pricingBasis`, message: "Программа поддерживает per_person или flat_package" });
    if (plan.quantityMetric !== "participants") issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}.quantityMetric`, message: "Программа использует quantityMetric=participants" });
    if (plan.pricingBasis === "per_person" && (plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null)) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}`, message: "Per-person тариф не использует included/extra" });
    if (plan.pricingBasis === "flat_package" && ((plan.includedQuantity === null) !== (plan.baseExtraUnitAmountMinor === null))) issues.push({ code: "PRICE_RULE_INVALID", path: `ratePlans.${plan.id}`, message: "Package extra требует одновременно includedQuantity и extraUnitAmount" });
    const rules = plan.rules.filter((rule) => rule.enabled && !rule.archived);
    for (const rule of rules) {
      if (plan.pricingBasis === "per_person" && rule.extraUnitAmountMinor !== null) issues.push({ code: "PRICE_RULE_INVALID", path: `priceRules.${rule.id}.extraUnitAmount`, message: "Per-person правило не использует extra-unit цену" });
      if (plan.pricingBasis === "flat_package" && rule.extraUnitAmountMinor !== null && plan.includedQuantity === null) issues.push({ code: "PRICE_RULE_INVALID", path: `priceRules.${rule.id}.extraUnitAmount`, message: "Package extra требует includedQuantity" });
    }
    for (let left = 0; left < rules.length; left += 1) for (let right = left + 1; right < rules.length; right += 1) {
      if (potentiallyAmbiguous(rules[left]!, rules[right]!)) issues.push({ code: "PRICE_RULE_AMBIGUOUS", path: `ratePlans.${plan.id}.rules`, message: "Правила имеют одинаковый ранг и пересекаются", ruleIds: [rules[left]!.id, rules[right]!.id] });
    }
  }
  return deepFreeze(issues);
}

function assertInputs(snapshot: ProgramPricingSnapshot, request: ProgramQuoteRequest, context: TrustedQuoteContext) {
  if (!Number.isFinite(context.calculatedAt.getTime()) || !Number.isSafeInteger(context.quoteTtlSeconds) || context.quoteTtlSeconds <= 0) fail("QUOTE_CLOCK_INVALID", "Серверное время расчёта некорректно");
  if (snapshot.offering.id !== request.offeringId || snapshot.offering.kind !== "program" || snapshot.offering.state !== "active") fail("OFFERING_NOT_QUOTABLE", "Программу нельзя рассчитать");
  if (snapshot.template.id !== request.programTemplateId) fail("PROGRAM_TEMPLATE_MISMATCH", "Шаблон не соответствует предложению");
  if (!isLocalDate(request.serviceDate)) fail("PROGRAM_QUOTE_INVALID_DATE", "Некорректная дата программы");
  if (!Number.isSafeInteger(request.participants) || request.participants <= 0) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество участников должно быть положительным");
  if (request.durationMinutes !== snapshot.template.durationMinutes) fail("PROGRAM_DURATION_MISMATCH", "Продолжительность расчёта должна совпадать с шаблоном программы");
  if (request.participants < (snapshot.template.minimumParticipants ?? 1) || request.participants > snapshot.template.participantLimit) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество участников не входит в лимиты шаблона");
  if (snapshot.offering.activePriceBookId !== snapshot.priceBook.id || snapshot.priceBook.state !== "active" || snapshot.priceBook.offeringId !== snapshot.offering.id) fail("PRICE_BOOK_NOT_ACTIVE", "Прайс-лист программы не активен");
  if (request.currency !== snapshot.offering.currency || request.currency !== snapshot.priceBook.currency) fail("PRICING_CURRENCY_MISMATCH", "Валюта расчёта не совпадает с валютой программы");
  if (request.serviceDate < snapshot.priceBook.validFrom || (snapshot.priceBook.validToExclusive !== null && request.serviceDate >= snapshot.priceBook.validToExclusive)) fail("PRICE_BOOK_COVERAGE_GAP", "Прайс-лист не покрывает дату программы");
  if (snapshot.calendar.state !== "active" || snapshot.calendar.id !== snapshot.offering.businessCalendarId) fail("CALENDAR_NOT_ACTIVE", "Календарь программы не активен");
  if (snapshot.offering.timezone !== snapshot.priceBook.timezone || snapshot.offering.timezone !== snapshot.calendar.timezone) fail("PRICING_TIMEZONE_MISMATCH", "Часовые пояса программы, прайса и календаря различаются");
}

function validatePlan(plan: HouseRatePlan, snapshot: ProgramPricingSnapshot, request: ProgramQuoteRequest) {
  if (plan.pricingBasis !== "per_person" && plan.pricingBasis !== "flat_package") fail("RATE_PLAN_BASIS_UNSUPPORTED", "Программа поддерживает per_person или flat_package");
  if (plan.quantityMetric !== "participants") fail("PRICE_RULE_INVALID", "Тариф программы должен использовать participants");
  if (plan.minQuantity !== null && request.participants < plan.minQuantity || plan.maxQuantity !== null && request.participants > plan.maxQuantity) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество участников не входит в лимиты тарифа");
  if (plan.minDurationMinutes !== null && request.durationMinutes < plan.minDurationMinutes || plan.maxDurationMinutes !== null && request.durationMinutes > plan.maxDurationMinutes) fail("PRICE_DURATION_OUT_OF_RANGE", "Продолжительность не входит в лимиты тарифа");
  if (plan.pricingBasis === "per_person" && (plan.includedQuantity !== null || plan.baseExtraUnitAmountMinor !== null)) fail("PRICE_RULE_INVALID", "Per-person тариф не использует included/extra");
  if (plan.pricingBasis === "flat_package") {
    const hasIncluded = plan.includedQuantity !== null;
    const hasExtra = plan.baseExtraUnitAmountMinor !== null;
    if (hasIncluded !== hasExtra) fail("PRICE_RULE_INVALID", "Package extra требует одновременно includedQuantity и extraUnitAmount");
    const capacity = plan.maxQuantity ?? snapshot.template.participantLimit;
    if (!hasExtra && request.participants > Math.min(plan.includedQuantity ?? capacity, capacity)) fail("PRICE_QUANTITY_OUT_OF_RANGE", "Количество участников превышает вместимость пакета");
  }
}

function selectRatePlan(plans: readonly HouseRatePlan[], key: string | null) {
  const active = plans.filter((plan) => !plan.archived);
  const selected = key === null ? active.filter((plan) => plan.isDefault) : active.filter((plan) => plan.key === key);
  if (selected.length !== 1) fail(key === null ? "RATE_PLAN_DEFAULT_AMBIGUOUS" : "RATE_PLAN_NOT_FOUND", "Тариф программы не найден однозначно");
  return selected[0]!;
}

function matchesRule(rule: HousePriceRule, date: string, dayClass: "weekday" | "weekend" | "holiday", quantity: number, leadDays: number, duration: number) {
  const selector = rule.dateSelector;
  const dateMatch = selector.type === "any_date"
    || selector.type === "custom_date_override" && date >= selector.from && date < selector.toExclusive
    || selector.type === "calendar_holiday" && dayClass === "holiday"
    || selector.type === "day_class" && selector.dayClass === dayClass
    || selector.type === "recurring_weekdays" && selector.days.includes(weekday(date));
  return dateMatch && inRange(quantity, rule.quantityRange) && inRange(leadDays, rule.bookingLeadDays) && inRange(duration, rule.durationMinutes);
}

function ruleRank(rule: HousePriceRule): readonly [number, number, number] {
  const dateRank = rule.dateSelector.type === "custom_date_override" ? 4 : rule.dateSelector.type === "calendar_holiday" ? 3 : rule.dateSelector.type === "day_class" || rule.dateSelector.type === "recurring_weekdays" ? 2 : 1;
  return [dateRank, Number(rule.quantityRange !== null) + Number(rule.bookingLeadDays !== null) + Number(rule.durationMinutes !== null), rule.priority];
}
function compareRank(left: readonly number[], right: readonly number[]) { for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index]! - right[index]!; return 0; }
function inRange(value: number, range: { min: number; max: number | null } | null) { return range === null || value >= range.min && (range.max === null || value <= range.max); }
function optionalRangesOverlap(left: { min: number; max: number | null } | null, right: { min: number; max: number | null } | null) { return left === null || right === null || left.min <= (right.max ?? Number.POSITIVE_INFINITY) && right.min <= (left.max ?? Number.POSITIVE_INFINITY); }
function selectorsOverlap(left: HouseDateSelector, right: HouseDateSelector) {
  if (left.type !== right.type) return false;
  if (left.type === "custom_date_override" && right.type === "custom_date_override") return left.from < right.toExclusive && right.from < left.toExclusive;
  if (left.type === "day_class" && right.type === "day_class") return left.dayClass === right.dayClass;
  if (left.type === "recurring_weekdays" && right.type === "recurring_weekdays") return left.days.some((day) => right.days.includes(day));
  return true;
}
function potentiallyAmbiguous(left: HousePriceRule, right: HousePriceRule) { return compareRank(ruleRank(left), ruleRank(right)) === 0 && selectorsOverlap(left.dateSelector, right.dateSelector) && optionalRangesOverlap(left.quantityRange, right.quantityRange) && optionalRangesOverlap(left.bookingLeadDays, right.bookingLeadDays) && optionalRangesOverlap(left.durationMinutes, right.durationMinutes); }
function weekday(date: string) { return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[new Date(`${date}T00:00:00.000Z`).getUTCDay()]!; }
function isLocalDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value; }
function localDateInTimeZone(value: Date, timezone: string) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value); } catch { fail("PRICING_TIMEZONE_MISMATCH", "Часовой пояс программы некорректен"); } }
function daysBetween(from: string, to: string) { return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000); }
function enumerateDates(from: string, toExclusive: string) { const result: string[] = []; for (let date = from; date < toExclusive; date = new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)) result.push(date); return result; }
function isMinor(value: number) { return Number.isSafeInteger(value) && value >= 0; }
function safeMultiply(left: number, right: number) { const value = left * right; if (!Number.isSafeInteger(value) || value < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта слишком велика"); return value; }
function safeSum(values: readonly number[]) { return values.reduce((sum, value) => safeAdd(sum, value), 0); }
function safeAdd(left: number, right: number) { const value = left + right; if (!Number.isSafeInteger(value) || value < 0) fail("PRICE_AMOUNT_OVERFLOW", "Сумма расчёта слишком велика"); return value; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
function fail(code: DomainError["code"], message: string, details: Record<string, unknown> = {}): never { throw new DomainError(code, message, { details }); }
