import { describe, expect, it } from "vitest"

import { MediaVersionedReplacements1788204400000 } from "./1788204400000-media-versioned-replacements.js"

describe("MediaVersionedReplacements migration", () => {
  it("records replacement intent/CAS and server-resolved page usage metadata", async () => {
    const statements: string[] = []
    await new MediaVersionedReplacements1788204400000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("ADD COLUMN purpose text NOT NULL DEFAULT 'initial'")
    expect(sql).toContain("ADD COLUMN expected_asset_version integer")
    expect(sql).toContain("ADD COLUMN base_blob_id uuid REFERENCES media_blobs(id)")
    expect(sql).toContain("media_uploads_replacement_guard_check")
    expect(sql).toContain("ADD COLUMN page_id uuid REFERENCES cms_nodes(id)")
    expect(sql).toContain("media_usages_owner_page_pointer_unique")
    expect(sql).toContain("media_usages_asset_page_idx")
  })

  it("restores the previous upload and usage shape on rollback", async () => {
    const statements: string[] = []
    await new MediaVersionedReplacements1788204400000().down({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("DROP COLUMN IF EXISTS base_blob_id")
    expect(sql).toContain("DROP COLUMN IF EXISTS expected_asset_version")
    expect(sql).toContain("DROP COLUMN IF EXISTS purpose")
    expect(sql).toContain("DROP COLUMN IF EXISTS path, DROP COLUMN IF EXISTS page_id")
    expect(sql).toContain("media_usages_owner_pointer_unique")
    expect(sql).not.toContain("DROP TABLE")
  })
})
