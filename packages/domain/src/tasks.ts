import { DomainError } from "./errors.js";

export type TaskStatus = "open" | "completed" | "cancelled" | "todo" | "in_progress" | "review" | "done";
export const taskTransitions: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  open: ["completed", "cancelled"],
  completed: ["open"],
  cancelled: ["open"],
  todo: ["in_progress", "done", "cancelled"],
  in_progress: ["review", "done", "cancelled", "todo"],
  review: ["in_progress", "done", "cancelled"],
  done: ["todo", "in_progress"],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return taskTransitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTask(from, to)) {
    throw new DomainError("INVALID_STATE_TRANSITION", `Task cannot transition from ${from} to ${to}`, {
      fieldErrors: { status: [`Transition ${from} → ${to} is not allowed`] },
      details: { from, to, allowed: taskTransitions[from] },
    });
  }
}
