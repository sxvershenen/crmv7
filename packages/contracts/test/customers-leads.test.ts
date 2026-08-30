import { describe, expect, it } from "vitest"

import { CustomerCreateSchema, LeadCreateSchema, LeadStatusSchema } from "../src/index.js"

describe("customers and leads contracts", () => {
  it("materializes safe defaults for a minimal customer", () => {
    const customer = CustomerCreateSchema.parse({ name: "Анна" })
    expect(customer).toMatchObject({ type: "person", phones: [], channels: [], consent: { processing: false, marketing: false } })
  })

  it("keeps the domain lead statuses canonical", () => {
    expect(LeadStatusSchema.safeParse("in_progress").success).toBe(true)
    expect(LeadStatusSchema.safeParse("work").success).toBe(false)
    expect(LeadCreateSchema.parse({ name: "Анна" }).status).toBe("new")
  })
})
