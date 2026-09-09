import { describe, expect, it } from "vitest"

import { inspectLegacyProgramOfferingPromotion } from "./cms-source-draft.js"

describe("program CMS source reconciliation", () => {
  it("reports exact and ambiguous primary program offering candidates without mutating", async () => {
    const link = { id: "legacy-link" }
    const manager = {
      getRepository: () => ({ findOneBy: async () => link }),
      query: async () => [{ id: "offering-a" }],
    }
    await expect(inspectLegacyProgramOfferingPromotion(manager as never, "template-a")).resolves.toEqual({ status: "eligible", programTemplateId: "template-a", legacyLinkId: "legacy-link", candidateOfferingIds: ["offering-a"] })
    manager.query = async () => [{ id: "offering-a" }, { id: "offering-b" }]
    await expect(inspectLegacyProgramOfferingPromotion(manager as never, "template-a")).resolves.toMatchObject({ status: "ambiguous", candidateOfferingIds: ["offering-a", "offering-b"] })
  })
})
