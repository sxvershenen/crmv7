import { describe, expect, it } from "vitest"

import {
  CmsMetrikaSettingsDetailSchema,
  CmsMetrikaSettingsMutationSchema,
  CmsMetrikaSettingsSchema,
  CmsSiteSettingsStoredValueSchema,
  PublicSiteSettingsSchema,
} from "../src/site-settings.js"

const id = "11111111-1111-4111-8111-111111111111"
const actorId = "22222222-2222-4222-8222-222222222222"
const timestamp = "2026-09-12T12:00:00+03:00"
const contentHash = "a".repeat(64)

describe("Yandex Metrika site settings contracts", () => {
  it("defaults to disabled and normalizes a valid positive counter ID", () => {
    expect(CmsMetrikaSettingsSchema.parse({})).toEqual({ enabled: false, counterId: null })
    expect(CmsMetrikaSettingsSchema.parse({ enabled: true, counterId: " 12345678901234567890 " })).toEqual({
      enabled: true,
      counterId: "12345678901234567890",
    })
  })

  it.each([
    { enabled: true, counterId: null },
    { enabled: true, counterId: "" },
    { enabled: true, counterId: "0" },
    { enabled: true, counterId: "0123" },
    { enabled: true, counterId: "123abc" },
    { enabled: true, counterId: "1".repeat(21) },
    { enabled: false, counterId: "123", snippet: "<script>alert(1)</script>" },
  ])("rejects missing, non-positive, non-numeric, oversized or arbitrary settings: %j", (value) => {
    expect(CmsMetrikaSettingsSchema.safeParse(value).success).toBe(false)
  })

  it("keeps the integration mutation strict, versioned and idempotent", () => {
    const input = CmsMetrikaSettingsMutationSchema.parse({
      operationId: id,
      idempotencyKey: "metrika-settings-update-0001",
      expectedVersion: 2,
      value: { enabled: false, counterId: "42" },
    })
    expect(input.value).toEqual({ enabled: false, counterId: "42" })
    expect(CmsMetrikaSettingsMutationSchema.safeParse({ ...input, script: "yaCounter()" }).success).toBe(false)
  })

  it("projects only normalized Metrika settings in CMS detail and public site settings", () => {
    const storedValue = CmsSiteSettingsStoredValueSchema.parse({ siteName: "Свистоплясово" })
    expect(storedValue.analytics.metrika).toEqual({ enabled: false, counterId: null })

    const revision = {
      id,
      revision: 1,
      state: "published" as const,
      value: { enabled: true, counterId: "12345" },
      contentHash,
      createdBy: actorId,
      createdAt: timestamp,
    }
    expect(CmsMetrikaSettingsDetailSchema.parse({ id, version: 2, draft: null, published: revision }).published?.value).toEqual({ enabled: true, counterId: "12345" })
    expect(PublicSiteSettingsSchema.parse({
      releaseId: id,
      revisionId: actorId,
      contentVersion: contentHash,
      publishedAt: timestamp,
      value: { siteName: "Свистоплясово", analytics: { metrika: revision.value } },
    }).value.analytics.metrika).toEqual(revision.value)
    expect(PublicSiteSettingsSchema.safeParse({
      releaseId: id,
      revisionId: actorId,
      contentVersion: contentHash,
      publishedAt: timestamp,
      value: { siteName: "Свистоплясово", analytics: { metrika: { ...revision.value, snippet: "yaCounter()" } } },
    }).success).toBe(false)
  })
})
