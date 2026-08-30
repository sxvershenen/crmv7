import { z } from "zod"

/** Query contract for the internal cross-entity CRM search. */
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(24),
}).strict()
export type SearchQuery = z.infer<typeof SearchQuerySchema>

export const SearchKindSchema = z.enum(["customer", "lead", "booking", "resource", "task", "program", "event"])
export type SearchKind = z.infer<typeof SearchKindSchema>

/**
 * Deliberately small result projection. It is safe to use in the command
 * palette and must not grow into a full entity DTO.
 */
export const SearchResultSchema = z.object({
  kind: SearchKindSchema,
  id: z.string().min(1).max(120),
  code: z.string().min(1).max(120).nullable(),
  title: z.string().min(1).max(500),
  meta: z.string().max(1_000),
  href: z.string().startsWith("/"),
  phone: z.string().max(100).nullable(),
  email: z.string().email().max(320).nullable(),
  archived: z.boolean(),
  capabilities: z.object({
    canView: z.boolean(),
    canEdit: z.boolean(),
    canArchive: z.boolean(),
  }).strict(),
}).strict()
export type SearchResult = z.infer<typeof SearchResultSchema>

export const SearchResponseSchema = SearchResultSchema.array()
export type SearchResponse = z.infer<typeof SearchResponseSchema>

// Names used by consumers that refer to this feature as global search.
export const GlobalSearchQuerySchema = SearchQuerySchema
export const GlobalSearchKindSchema = SearchKindSchema
export const GlobalSearchResultSchema = SearchResultSchema
export const GlobalSearchResponseSchema = SearchResponseSchema
export type GlobalSearchQuery = SearchQuery
export type GlobalSearchResult = SearchResult
export type GlobalSearchResponse = SearchResponse
