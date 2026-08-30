import { describe, expect, it } from "vitest";
import { ApiErrorSchema, AvailabilityQuerySchema, FinanceQuerySchema, LoginRequestSchema, MoneySchema, PaymentOperationSchema, SavedViewUpdateSchema, TaskCreateSchema, TaskListQuerySchema, TaskUpdateSchema, UpdateBookingInputSchema } from "../src";

describe("canonical contracts", () => {
  it("rejects malformed money and accepts integer minor units", () => {
    expect(MoneySchema.safeParse({ amountMinor: 10.2, currency: "RUB" }).success).toBe(false);
    expect(MoneySchema.parse({ amountMinor: 1000, currency: "RUB" })).toEqual({ amountMinor: 1000, currency: "RUB" });
  });
  it("keeps API errors serializable and field-addressable", () => {
    const result = ApiErrorSchema.parse({ code: "RESOURCE_CONFLICT", message: "Занято", fieldErrors: { endAt: ["Пересечение"] }, details: {} });
    expect(result.fieldErrors?.endAt).toEqual(["Пересечение"]);
  });
  it("validates auth, task and availability command boundaries", () => {
    expect(LoginRequestSchema.safeParse({ email: "not-email", password: "x" }).success).toBe(false);
    expect(TaskCreateSchema.safeParse({ title: "  " }).success).toBe(false);
    expect(TaskListQuerySchema.parse({}).limit).toBe(50);
    expect(AvailabilityQuerySchema.safeParse({ resourceId: "bad", startAt: "2026-01-01T10:00:00+03:00", endAt: "2026-01-01T11:00:00+03:00" }).success).toBe(false);
  });

  it("keeps task updates sparse instead of applying create defaults", () => {
    expect(TaskUpdateSchema.parse({ version: 2, status: "in_progress" })).toEqual({
      version: 2,
      status: "in_progress",
    });
  });

  it("keeps booking updates sparse and enforces compensating payment references", () => {
    expect(UpdateBookingInputSchema.parse({ expectedVersion: 3 })).toEqual({ expectedVersion: 3 });
    expect(PaymentOperationSchema.safeParse({
      bookingId: "11111111-1111-4111-8111-111111111111",
      operationId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "payment-operation-0001",
      expectedVersion: 1,
      type: "refund",
      amount: { amountMinor: 100, currency: "RUB" },
      method: "card",
    }).success).toBe(false);
  });

  it("keeps saved-view updates sparse", () => {
    expect(SavedViewUpdateSchema.parse({ version: 4, name: "Мой вид" })).toEqual({ version: 4, name: "Мой вид" });
  });

  it("validates the finance projection boundary", () => {
    expect(FinanceQuerySchema.parse({ date: "2026-08-01", rangeEnd: "2026-08-31" })).toMatchObject({ page: 1, pageSize: 25, section: "summary" });
    expect(FinanceQuerySchema.safeParse({ date: "31.08.2026", rangeEnd: "2026-08-31" }).success).toBe(false);
  });
});
