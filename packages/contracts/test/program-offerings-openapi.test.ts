import { describe, expect, it } from "vitest"

import { internalOpenApiDocument } from "../src/openapi.js"
import { adminOpenApiDocument, publicOpenApiDocument } from "../src/phase4-openapi.js"

describe("program offering OpenAPI isolation", () => {
  it("documents Gate A only on private surfaces", () => {
    for (const path of ["/programs/{programTemplateId}/offering", "/programs/{programTemplateId}/offering/quotes/preview"] as const) {
      expect(internalOpenApiDocument.paths?.[path]).toBeDefined()
      expect(adminOpenApiDocument.paths?.[path]).toBeDefined()
      expect(publicOpenApiDocument.paths?.[path]).toBeUndefined()
    }
    expect(internalOpenApiDocument.paths?.["/programs/{programTemplateId}/offering"]?.get).toBeDefined()
    expect(adminOpenApiDocument.paths?.["/programs/{programTemplateId}/offering"]?.get).toBeDefined()
    expect(internalOpenApiDocument.paths?.["/programs/{programTemplateId}/offering"]?.post).toBeDefined()
    expect(adminOpenApiDocument.paths?.["/programs/{programTemplateId}/offering"]?.post).toBeDefined()
    expect(JSON.stringify(publicOpenApiDocument)).not.toContain("ProgramOfferingQuoteResult")
    expect(internalOpenApiDocument.paths?.["/programs/{programTemplateId}/offering/quotes/preview"]?.post?.summary).toContain("non-acceptance-ready")
  })

  it("documents occurrence acceptance quotes only in the operational internal namespace", () => {
    const path = "/programs/occurrences/{programOccurrenceId}/offering/quotes/registration"
    expect(internalOpenApiDocument.paths?.[path]?.post).toBeDefined()
    expect(adminOpenApiDocument.paths?.[path]).toBeUndefined()
    expect(publicOpenApiDocument.paths?.[path]).toBeUndefined()
  })
})
