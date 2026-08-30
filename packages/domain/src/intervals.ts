import { DomainError } from "./errors.js";

export interface TimeInterval { readonly startAt: Date; readonly endAt: Date; }

function validDate(value: Date): boolean { return Number.isFinite(value.getTime()); }

/** Creates a half-open [startAt, endAt) interval. Inputs are cloned to prevent mutation. */
export function createInterval(startAt: Date, endAt: Date): TimeInterval {
  if (!validDate(startAt) || !validDate(endAt) || startAt.getTime() >= endAt.getTime()) {
    throw new DomainError("INVALID_INTERVAL", "Interval end must be after its start", {
      fieldErrors: { endAt: ["endAt must be after startAt"] },
    });
  }
  return { startAt: new Date(startAt.getTime()), endAt: new Date(endAt.getTime()) };
}

export function intervalFromIso(startAt: string, endAt: string): TimeInterval {
  const start = new Date(startAt); const end = new Date(endAt);
  return createInterval(start, end);
}

/** Half-open intervals touching at an endpoint do not overlap. */
export function overlaps(left: TimeInterval, right: TimeInterval): boolean {
  return left.startAt.getTime() < right.endAt.getTime() && right.startAt.getTime() < left.endAt.getTime();
}

export function contains(container: TimeInterval, instant: Date): boolean {
  const time = instant.getTime();
  return container.startAt.getTime() <= time && time < container.endAt.getTime();
}

export function durationMilliseconds(interval: TimeInterval): number {
  return interval.endAt.getTime() - interval.startAt.getTime();
}

export function findOverlaps<T extends TimeInterval>(needle: TimeInterval, candidates: readonly T[]): T[] {
  return candidates.filter((candidate) => overlaps(needle, candidate));
}
