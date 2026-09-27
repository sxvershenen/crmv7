import { describe, expect, it } from "vitest"

import { CmsPublicationPreviewSchema } from "../src/publication.js"

describe("publication preview contract", () => {
  it("accepts nested SEO and hero data from a materialized page", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    expect(CmsPublicationPreviewSchema.parse({
      nodeId: id, revisionId: id, baseReleaseId: null, activeReleaseVersion: 1,
      previewHash: "a".repeat(64), generatedAt: "2026-09-27T09:00:00.000Z",
      renderReadyPage: {
        path: "/domiki/dom-u-ozera", title: "Дом у озера",
        seo: { title: "Дом у озера", canonical: { mode: "self" }, structuredData: [] },
        hero: { title: "Дом у озера", media: { desktop: { assetId: id } } },
      },
      changes: [], affectedPaths: [], cacheTags: [], dependencies: [], issues: [], canPublish: true,
    }).renderReadyPage).toMatchObject({ seo: { canonical: { mode: "self" } } })
  })
})
