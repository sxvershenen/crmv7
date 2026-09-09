import { DomainError } from "./errors.js";

export type AcceptedQuoteOperationalContext = Readonly<{
  kind: "house_stay";
  subjectVersion: number;
  primaryResourceId: string;
  primaryResourceVersion: number;
}>;

export type QuoteSnapshotForAcceptance = Readonly<{
  id: string;
  validUntil: Date;
  operationalContext: AcceptedQuoteOperationalContext | null;
}>;

export type QuoteAcceptanceTarget = Readonly<{
  type: "booking_item" | "event" | "program_registration";
  id: string;
  expectedVersion: number;
  actualVersion: number;
  status: string;
  archived: boolean;
}>;

function validInstant(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

/** Server time is authoritative; legacy snapshots lacking context fail closed. */
export function assertQuoteSnapshotAcceptable(snapshot: QuoteSnapshotForAcceptance, acceptedAt: Date): void {
  if (!validInstant(acceptedAt) || !validInstant(snapshot.validUntil)) {
    throw new DomainError("QUOTE_ACCEPTANCE_INVALID", "Время принятия или срок действия quote некорректны");
  }
  if (snapshot.operationalContext === null) {
    throw new DomainError("QUOTE_NOT_ACCEPTANCE_READY", "Legacy quote без operational context нельзя принять", { details: { quoteSnapshotId: snapshot.id } });
  }
  if (snapshot.validUntil.getTime() <= acceptedAt.getTime()) {
    throw new DomainError("QUOTE_SNAPSHOT_EXPIRED", "Срок действия quote истёк", { details: { quoteSnapshotId: snapshot.id, validUntil: snapshot.validUntil.toISOString() } });
  }
}

/** Matches the transition contract to the persisted operational target lock. */
export function assertQuoteAcceptanceTarget(target: QuoteAcceptanceTarget): void {
  if (target.archived) {
    throw new DomainError("QUOTE_ACCEPTANCE_INVALID", "Нельзя принять quote для архивированной операции", { details: { targetId: target.id } });
  }
  if (target.actualVersion !== target.expectedVersion) {
    throw new DomainError("QUOTE_ACCEPTANCE_TARGET_VERSION_CONFLICT", "Версия операции изменилась до принятия quote", {
      details: { targetId: target.id, expectedVersion: target.expectedVersion, actualVersion: target.actualVersion },
    });
  }
  const expectedStatus = target.type === "booking_item" ? "confirmed" : target.type === "event" ? "booked" : "confirmed";
  if (target.status !== expectedStatus) {
    throw new DomainError("QUOTE_ACCEPTANCE_INVALID", "Quote можно принять только в целевом lifecycle status", {
      details: { targetId: target.id, targetType: target.type, status: target.status, expectedStatus },
    });
  }
}

/** No target can consume two snapshots and one snapshot cannot be reused. */
export function assertUniqueQuoteAcceptances(acceptances: readonly Readonly<{ targetId: string; quoteSnapshotId: string }>[]): void {
  const targets = new Set<string>();
  const quotes = new Set<string>();
  for (const acceptance of acceptances) {
    if (targets.has(acceptance.targetId)) {
      throw new DomainError("QUOTE_ALREADY_ACCEPTED", "Операционный target уже содержит принятую цену", { details: { targetId: acceptance.targetId } });
    }
    if (quotes.has(acceptance.quoteSnapshotId)) {
      throw new DomainError("QUOTE_ALREADY_ACCEPTED", "Один quote snapshot нельзя принять более одного раза", { details: { quoteSnapshotId: acceptance.quoteSnapshotId } });
    }
    targets.add(acceptance.targetId);
    quotes.add(acceptance.quoteSnapshotId);
  }
}
