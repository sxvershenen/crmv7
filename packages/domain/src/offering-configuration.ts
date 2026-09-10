import { createHash } from "node:crypto";

import { DomainError } from "./errors.js";

export type CalendarDayClass = "weekday" | "weekend" | "holiday";
export type CalendarState = "draft" | "active" | "retired";

export type CalendarCoverage = Readonly<{ from: string; toExclusive: string }>;
export type CalendarImportDay = Readonly<{ date: string; dayClass: CalendarDayClass; label: string | null }>;
export type CalendarOverrideForHash = Readonly<{ date: string; dayClass: CalendarDayClass; label: string | null; reason: string; active: boolean }>;
export type CalendarActivationInput = Readonly<{
  currentState: CalendarState;
  sourceVersion: string;
  coverage: CalendarCoverage | null;
  importedDays: readonly CalendarImportDay[];
  overrides?: readonly CalendarOverrideForHash[];
  contentHash: string | null;
}>;

export type HouseBindingInput = Readonly<{
  target: Readonly<{ type: "resource" | "resource_group" | "program_template" | "event_service_template"; id: string }>;
  role: "primary" | "required" | "optional" | "shared_area" | "inventory_unit";
  availabilityRequired: boolean;
  defaultQuantity: number;
  defaultCapacityImpact: number;
  preparationBeforeMinutes: number;
  preparationAfterMinutes: number;
}>;

export type CampgroundFulfillmentInput = Readonly<{
  salesUnit: "owned_tent" | "own_tent_pitch";
  allocationMode: "discrete_inventory" | "shared_capacity";
}>;
export type VenueResourceFact = Readonly<{
  id: string;
  kind: string;
  capacityMode: "fixed" | "shared";
  capacityTotal: number;
  archived: boolean;
}>;
export type CampgroundResourceFact = Readonly<{
  id: string;
  capacityMode: "fixed" | "shared";
  archived: boolean;
}>;
export type CampgroundGroupMembershipFact = Readonly<{
  resourceId: string;
  role: "owned_tent" | "own_tent_area" | "common_area";
  groupState: "draft" | "active" | "archived";
  archived: boolean;
}>;

export type AddOnCandidate = Readonly<{
  id: string;
  kind: string;
  state: "draft" | "active" | "paused" | "archived";
  archived: boolean;
  scope: "reusable" | "offering_specific";
  ownerOfferingId: string | null;
}>;
export type AddOnAssignmentInput = Readonly<{
  addOnOfferingId: string;
  enabled: boolean;
  required: boolean;
  recommended: boolean;
  minQuantityOverride: number | null;
  maxQuantityOverride: number | null;
  defaultQuantityOverride: number | null;
}>;

function invalid(code: "CALENDAR_INVALID_COVERAGE" | "OFFERING_BINDING_INVALID" | "OFFERING_ADDON_INVALID", message: string, field: string, details: Record<string, unknown> = {}): never {
  throw new DomainError(code, message, { fieldErrors: { [field]: [message] }, details });
}

function dateAtUtcMidnight(date: string): number {
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date);
  if (!parsed) invalid("CALENDAR_INVALID_COVERAGE", "Дата календаря должна иметь формат YYYY-MM-DD", "date", { date });
  const timestamp = Date.UTC(Number(parsed![1]), Number(parsed![2]) - 1, Number(parsed![3]));
  const check = new Date(timestamp);
  if (check.getUTCFullYear() !== Number(parsed![1]) || check.getUTCMonth() !== Number(parsed![2]) - 1 || check.getUTCDate() !== Number(parsed![3])) {
    invalid("CALENDAR_INVALID_COVERAGE", "Дата календаря не существует", "date", { date });
  }
  return timestamp;
}

function formatUtcDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function validateCalendarCoverage(coverage: CalendarCoverage): { from: number; toExclusive: number } {
  const from = dateAtUtcMidnight(coverage.from);
  const toExclusive = dateAtUtcMidnight(coverage.toExclusive);
  if (from >= toExclusive) invalid("CALENDAR_INVALID_COVERAGE", "Покрытие календаря должно иметь положительную длину", "coverage.toExclusive");
  return { from, toExclusive };
}

/** Ensures an imported calendar is one complete immutable local-date series. */
export function validateBusinessCalendarImport(coverage: CalendarCoverage, days: readonly CalendarImportDay[]): void {
  const { from, toExclusive } = validateCalendarCoverage(coverage);

  const seen = new Set<string>();
  for (const day of days) {
    const instant = dateAtUtcMidnight(day.date);
    if (instant < from || instant >= toExclusive) invalid("CALENDAR_INVALID_COVERAGE", "Дата импорта вне покрытия календаря", "days", { date: day.date });
    if (seen.has(day.date)) invalid("CALENDAR_INVALID_COVERAGE", "Дата импорта повторяется", "days", { date: day.date });
    seen.add(day.date);
  }
  for (let instant = from; instant < toExclusive; instant += 86_400_000) {
    const date = formatUtcDate(instant);
    if (!seen.has(date)) invalid("CALENDAR_INVALID_COVERAGE", "Импорт должен покрывать каждый локальный день без пробелов", "days", { missingDate: date });
  }
}

/** Hash exactly the material that determines pricing day class, independent of input order. */
export function businessCalendarContentHash(sourceVersion: string, coverage: CalendarCoverage, days: readonly CalendarImportDay[], overrides: readonly CalendarOverrideForHash[] = []): string {
  validateBusinessCalendarImport(coverage, days);
  const canonical = JSON.stringify({
    sourceVersion,
    coverage: { from: coverage.from, toExclusive: coverage.toExclusive },
    days: [...days].sort((left, right) => left.date.localeCompare(right.date)).map((day) => ({
      date: day.date, dayClass: day.dayClass, label: day.label,
    })),
    overrides: [...overrides].filter((override) => override.active).sort((left, right) => left.date.localeCompare(right.date)).map((override) => ({
      date: override.date, dayClass: override.dayClass, label: override.label, reason: override.reason,
    })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateBusinessCalendarActivation(input: CalendarActivationInput): void {
  if (input.currentState !== "draft") {
    throw new DomainError("CALENDAR_INVALID_TRANSITION", "Активировать можно только черновик календаря", { details: { state: input.currentState } });
  }
  if (input.coverage === null || input.contentHash === null) {
    throw new DomainError("CALENDAR_INVALID_COVERAGE", "Нельзя активировать календарь без полного импорта", { fieldErrors: { coverage: ["Требуется полный импорт календаря"] } });
  }
  validateBusinessCalendarImport(input.coverage, input.importedDays);
  const expectedHash = businessCalendarContentHash(input.sourceVersion, input.coverage, input.importedDays, input.overrides);
  if (!/^[a-f0-9]{64}$/.test(input.contentHash)) {
    throw new DomainError("CALENDAR_INVALID_COVERAGE", "Хеш календаря имеет неверный формат", { fieldErrors: { contentHash: ["Ожидается SHA-256"] } });
  }
  if (expectedHash !== input.contentHash) {
    throw new DomainError("CALENDAR_INVALID_COVERAGE", "Хеш календаря не соответствует импортированным дням", { fieldErrors: { contentHash: ["Календарь был изменён после хеширования"] } });
  }
}

/** Active calendars may be corrected or extended, but historical coverage is never removed. */
export function validateBusinessCalendarCoverageChange(current: CalendarCoverage | null, next: CalendarCoverage): void {
  validateCalendarCoverage(next);
  if (current !== null && (next.from > current.from || next.toExclusive < current.toExclusive)) {
    throw new DomainError("CALENDAR_INVALID_COVERAGE", "Нельзя сокращать уже опубликованное покрытие календаря", {
      fieldErrors: { coverage: ["Разрешены только исправление или расширение покрытия"] },
      details: { current, next },
    });
  }
}

export function assertBusinessCalendarMutable(state: CalendarState): void {
  if (state === "retired") {
    throw new DomainError("CALENDAR_IMMUTABLE", "Изменять retired календарь нельзя", { details: { state } });
  }
}

/** House commercial identity always has one resource primary and typed resource dependencies. */
export function validateHouseOfferingBindings(bindings: readonly HouseBindingInput[]): void {
  const primary = bindings.filter((binding) => binding.role === "primary");
  if (primary.length !== 1 || primary[0]!.target.type !== "resource") {
    invalid("OFFERING_BINDING_INVALID", "Домик требует ровно один primary binding к Resource", "bindings");
  }
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (binding.target.type !== "resource") invalid("OFFERING_BINDING_INVALID", "Домик может ссылаться только на Resource", "bindings");
    const key = `${binding.target.id}:${binding.role}`;
    if (seen.has(key)) invalid("OFFERING_BINDING_INVALID", "Одинаковая resource-role связь указана дважды", "bindings", { key });
    seen.add(key);
    if (!Number.isInteger(binding.defaultQuantity) || binding.defaultQuantity <= 0) invalid("OFFERING_BINDING_INVALID", "Количество binding должно быть положительным", "bindings");
    if (!Number.isInteger(binding.defaultCapacityImpact) || binding.defaultCapacityImpact < 0) invalid("OFFERING_BINDING_INVALID", "Capacity impact не может быть отрицательным", "bindings");
  }
}

/** A venue sells one exclusive Resource; capacity and availability stay Resource-owned. */
export function validateVenueOfferingBindings(bindings: readonly HouseBindingInput[], resources: readonly VenueResourceFact[]): void {
  const primary = bindings.filter((binding) => binding.role === "primary");
  if (primary.length !== 1 || primary[0]!.target.type !== "resource") {
    invalid("OFFERING_BINDING_INVALID", "Площадка требует ровно один primary binding к Resource", "bindings");
  }
  const primaryResource = resources.find((resource) => resource.id === primary[0]!.target.id);
  if (!primaryResource || primaryResource.archived || (primaryResource.kind !== "venues" && primaryResource.kind !== "venue")) {
    invalid("OFFERING_BINDING_INVALID", "Primary binding площадки должен ссылаться на активный Resource kind=venues", "bindings");
  }
  if (primaryResource.capacityMode !== "fixed" || primaryResource.capacityTotal <= 0) {
    invalid("OFFERING_BINDING_INVALID", "Площадка требует положительную fixed capacity Resource", "bindings");
  }
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (binding.target.type !== "resource") invalid("OFFERING_BINDING_INVALID", "Площадка может ссылаться только на Resource", "bindings");
    const key = `${binding.target.id}:${binding.role}`;
    if (seen.has(key)) invalid("OFFERING_BINDING_INVALID", "Одинаковая resource-role связь указана дважды", "bindings", { key });
    seen.add(key);
    if (binding.role === "primary" && (binding.defaultQuantity !== 1 || binding.defaultCapacityImpact !== 1 || !binding.availabilityRequired)) {
      invalid("OFFERING_BINDING_INVALID", "Primary binding площадки должен резервировать один доступный Resource", "bindings");
    }
    if (!Number.isInteger(binding.defaultQuantity) || binding.defaultQuantity <= 0) invalid("OFFERING_BINDING_INVALID", "Количество binding должно быть положительным", "bindings");
    if (!Number.isInteger(binding.defaultCapacityImpact) || binding.defaultCapacityImpact < 0) invalid("OFFERING_BINDING_INVALID", "Capacity impact не может быть отрицательным", "bindings");
  }
}

/** A campground group is never the sellable target; its member Resource is. */
export function validateCampgroundOfferingBindings(
  fulfillment: CampgroundFulfillmentInput,
  bindings: readonly HouseBindingInput[],
  resources: readonly CampgroundResourceFact[],
  memberships: readonly CampgroundGroupMembershipFact[],
): void {
  const primary = bindings.filter((binding) => binding.role === "primary");
  if (primary.length !== 1 || primary[0]!.target.type !== "resource") {
    invalid("OFFERING_BINDING_INVALID", "Кемпинг требует ровно один primary binding к Resource", "bindings");
  }
  if (
    (fulfillment.salesUnit === "owned_tent" && fulfillment.allocationMode !== "discrete_inventory")
    || (fulfillment.salesUnit === "own_tent_pitch" && fulfillment.allocationMode !== "shared_capacity")
  ) {
    invalid("OFFERING_BINDING_INVALID", "Тип продаваемой единицы не совпадает с режимом аллокации", "fulfillment");
  }
  const seen = new Set<string>();
  for (const binding of bindings) {
    if (binding.target.type !== "resource") invalid("OFFERING_BINDING_INVALID", "ResourceGroup не является продаваемой единицей кемпинга", "bindings");
    const key = `${binding.target.id}:${binding.role}`;
    if (seen.has(key)) invalid("OFFERING_BINDING_INVALID", "Одинаковая resource-role связь указана дважды", "bindings", { key });
    seen.add(key);
    if (!Number.isInteger(binding.defaultQuantity) || binding.defaultQuantity <= 0) invalid("OFFERING_BINDING_INVALID", "Количество binding должно быть положительным", "bindings");
    if (!Number.isInteger(binding.defaultCapacityImpact) || binding.defaultCapacityImpact < 0) invalid("OFFERING_BINDING_INVALID", "Capacity impact не может быть отрицательным", "bindings");
  }

  const primaryId = primary[0]!.target.id;
  const resource = resources.find((candidate) => candidate.id === primaryId);
  if (!resource || resource.archived) invalid("OFFERING_BINDING_INVALID", "Основной ресурс кемпинга не найден или архивирован", "bindings");
  const expectedMode = fulfillment.salesUnit === "owned_tent" ? "fixed" : "shared";
  if (resource.capacityMode !== expectedMode) {
    invalid("OFFERING_BINDING_INVALID", "Режим вместимости ресурса не соответствует типу кемпинга", "bindings", { expectedMode, actualMode: resource.capacityMode });
  }
  const expectedRole = fulfillment.salesUnit === "owned_tent" ? "owned_tent" : "own_tent_area";
  const activeMemberships = memberships.filter((membership) => membership.resourceId === primaryId && !membership.archived && membership.groupState === "active" && membership.role === expectedRole);
  if (activeMemberships.length !== 1) {
    invalid("OFFERING_BINDING_INVALID", "Продаваемый ресурс должен входить ровно в одну активную campground-группу с подходящей ролью", "bindings", { expectedRole });
  }
}

export function validateOfferingAddOnAssignments(offeringId: string, assignments: readonly AddOnAssignmentInput[], candidates: readonly AddOnCandidate[]): void {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const used = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.addOnOfferingId === offeringId) invalid("OFFERING_ADDON_INVALID", "Нельзя назначить предложение само себе как доп", "assignments");
    if (used.has(assignment.addOnOfferingId)) invalid("OFFERING_ADDON_INVALID", "Доп может быть назначен только один раз", "assignments", { addOnOfferingId: assignment.addOnOfferingId });
    used.add(assignment.addOnOfferingId);
    const candidate = candidateById.get(assignment.addOnOfferingId);
    if (!candidate || candidate.kind !== "addon" || candidate.archived || candidate.state === "archived") {
      invalid("OFFERING_ADDON_INVALID", "Назначать можно только неархивный add-on offering", "assignments", { addOnOfferingId: assignment.addOnOfferingId });
    }
    if (candidate.scope === "offering_specific" && candidate.ownerOfferingId !== offeringId) {
      invalid("OFFERING_ADDON_INVALID", "Offering-specific доп доступен только своему владельцу", "assignments", { addOnOfferingId: candidate.id });
    }
    if (assignment.required && !assignment.enabled) invalid("OFFERING_ADDON_INVALID", "Обязательный доп должен быть включён", "assignments");
    if (assignment.required && assignment.recommended) invalid("OFFERING_ADDON_INVALID", "Обязательный доп не может быть recommended", "assignments");
    const { minQuantityOverride: min, maxQuantityOverride: max, defaultQuantityOverride: defaultQuantity } = assignment;
    if (min !== null && max !== null && min > max) invalid("OFFERING_ADDON_INVALID", "Неверный диапазон количества допа", "assignments");
    if (defaultQuantity !== null && ((min !== null && defaultQuantity < min) || (max !== null && defaultQuantity > max))) {
      invalid("OFFERING_ADDON_INVALID", "Количество по умолчанию вне разрешённого диапазона", "assignments");
    }
  }
}
