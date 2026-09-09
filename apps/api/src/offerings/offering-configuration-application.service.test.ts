import { describe, expect, it } from "vitest"

import { DomainError } from "@crm/domain"

import { OfferingConfigurationApplicationService } from "./offering-configuration-application.service.js"

describe("OfferingConfigurationApplicationService guards", () => {
  const service = new OfferingConfigurationApplicationService({} as never)

  it("maps shared domain validation failures to an API validation error", () => {
    expect(() => (service as unknown as { validateDomain(action: () => void): void }).validateDomain(() => {
      throw new DomainError("OFFERING_BINDING_INVALID", "invalid", { fieldErrors: { bindings: ["invalid"] } })
    })).toThrow("invalid")
  })
})
