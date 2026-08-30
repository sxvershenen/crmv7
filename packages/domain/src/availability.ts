import { DomainError } from "./errors.js";
import { createInterval, overlaps, type TimeInterval } from "./intervals.js";

export interface AvailabilityAllocation extends TimeInterval {
  readonly id: string;
  readonly resourceId: string;
  readonly sourceId: string;
  readonly quantity: number;
  /** Optional override when one reservation consumes more than one capacity unit. */
  readonly capacityImpact?: number;
  readonly status: "tentative" | "active" | "cancelled";
}

export interface AvailabilityRequest {
  readonly resourceId: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly quantity: number;
  readonly excludeSourceId?: string;
}

export interface AvailabilityPolicy {
  /** Omit for a single-capacity resource where any overlap is a conflict. */
  readonly capacity?: number;
}

export interface AvailabilityConflict {
  readonly allocationId: string;
  readonly sourceId: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly requestedQuantity: number;
  readonly availableQuantity: number;
  readonly reason: "overlap" | "capacity";
}

export interface AvailabilityCheck { readonly available: boolean; readonly conflicts: readonly AvailabilityConflict[]; }

export function checkAvailability(
  request: AvailabilityRequest,
  allocations: readonly AvailabilityAllocation[],
  policy: AvailabilityPolicy = {},
): AvailabilityCheck {
  const requestedInterval = createInterval(request.startAt, request.endAt);
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    throw new DomainError("CAPACITY_EXCEEDED", "Requested quantity must be a positive integer");
  }
  if (policy.capacity !== undefined && (!Number.isInteger(policy.capacity) || policy.capacity <= 0)) {
    throw new DomainError("CAPACITY_EXCEEDED", "Resource capacity must be a positive integer");
  }
  const relevant = allocations.filter((allocation) =>
    allocation.resourceId === request.resourceId && allocation.status !== "cancelled" &&
    allocation.sourceId !== request.excludeSourceId && overlaps(requestedInterval, allocation) &&
    Number.isInteger(allocation.quantity) && allocation.quantity > 0,
  );
  if (policy.capacity === undefined) {
    return {
      available: relevant.length === 0,
      conflicts: relevant.map((a) => ({ allocationId: a.id, sourceId: a.sourceId, startAt: new Date(a.startAt), endAt: new Date(a.endAt), requestedQuantity: request.quantity, availableQuantity: 0, reason: "overlap" as const })),
    };
  }
  // Sweep all interval boundaries so two individually-valid allocations cannot
  // collectively exceed the resource capacity.
  const boundaries = [requestedInterval.startAt.getTime(), requestedInterval.endAt.getTime()];
  for (const allocation of relevant) {
    boundaries.push(Math.max(requestedInterval.startAt.getTime(), allocation.startAt.getTime()));
    boundaries.push(Math.min(requestedInterval.endAt.getTime(), allocation.endAt.getTime()));
  }
  boundaries.sort((left, right) => left - right);
  const violating = new Set<string>();
  let minimumAvailable = policy.capacity!;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const left = boundaries[index]!; const right = boundaries[index + 1]!;
    if (left >= right) continue;
    const midpoint = new Date(left + (right - left) / 2);
    const active = relevant.filter((allocation) => allocation.startAt.getTime() <= midpoint.getTime() && midpoint.getTime() < allocation.endAt.getTime());
    const used = active.reduce((sum, allocation) => sum + (allocation.capacityImpact ?? allocation.quantity), 0);
    const available = policy.capacity! - used;
    minimumAvailable = Math.min(minimumAvailable, available);
    if (available < request.quantity) active.forEach((allocation) => violating.add(allocation.id));
  }
  const conflicts = relevant.filter((allocation) => violating.has(allocation.id)).map((a) => ({ allocationId: a.id, sourceId: a.sourceId, startAt: new Date(a.startAt), endAt: new Date(a.endAt), requestedQuantity: request.quantity, availableQuantity: Math.max(0, minimumAvailable), reason: "capacity" as const }));
  return { available: conflicts.length === 0, conflicts };
}

export function assertAvailable(check: AvailabilityCheck): void {
  if (!check.available) throw new DomainError("CAPACITY_EXCEEDED", "Resource is not available", {
    details: { conflicts: check.conflicts },
  });
}
