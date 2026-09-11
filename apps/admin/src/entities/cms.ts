import type { CmsPageKind, CmsSourceKind } from "@crm/contracts/content"
import type { CmsHomeSectionDraft, CmsPartnersSectionDraft, CmsWhyUsSectionDraft } from "@crm/contracts"
import type { CmsPublicationPreview } from "@crm/contracts/publication"

export type ContentStatus = "draft" | "review" | "scheduled" | "published" | "archived" | "failed"
export type SourceKind = "CMS" | "CRM" | "computed" | "inherited"
export type QualityLevel = "ok" | "warning" | "blocker"
export type InheritanceMode = "inherit" | "override" | "disabled"

export type ContentNode = {
  id: string
  title: string
  path: string
  /** Exact CMS page kind from the authoritative content-node identity. */
  pageKind: CmsPageKind
  /** Authoritative placement from the active editorial revision. */
  sortOrder: number
  type: "home" | "landing" | "category" | "profile" | "article"
  status: ContentStatus
  quality: QualityLevel
  parentId: string | null
  children: string[]
  owner: string
  updatedLabel: string
  inboundLinks: number | null
  mediaCount: number | null
  source?: "CMS" | "CRM"
  /** Exact source-link kind when this editorial draft is CRM-originated. */
  sourceKind?: CmsSourceKind
  importedDraft?: boolean
}

export type DashboardMetric = { id: string; label: string; value: string; detail: string; trend?: string }
export type AttentionItem = { id: string; title: string; detail: string; href: string; tone: "danger" | "warning" | "info" }
export type ActivityItem = { id: string; actor: string; action: string; target: string; when: string; status: ContentStatus }

export type CmsDashboard = {
  productionRelease: string
  publishedAt: string
  drafts: number
  queueHealthy: boolean
  metrics: DashboardMetric[]
  attention: AttentionItem[]
  activity: ActivityItem[]
  funnel: { visitors: number; leads: number; bookings: number; paid: number }
}

export type SectionConfig = {
  id: string
  key?: string
  partnersConfig?: CmsPartnersSectionDraft
  whyUsConfig?: CmsWhyUsSectionDraft
  homepageConfig?: CmsHomeSectionDraft
  label: string
  description: string
  mode: InheritanceMode
  source: string
  sourceHref: string
  effectiveTitle: string
  quality?: QualityLevel
}

export type HeroConfig = {
  mode: InheritanceMode
  eyebrow: string
  title: string
  description: string
  primaryCtaLabel: string
  primaryCtaTarget: string
  secondaryCtaLabel: string
  secondaryCtaTarget: string
  desktopImage: string
  mobileImage: string
  overlay: number
  focalPosition: "left" | "center" | "right"
  alignment: "left" | "center"
}

export type PublicNavigationItem = {
  id: string
  label: string
  href: string
  icon: string
  color: string
  visible: boolean
  children: PublicNavigationItem[]
}

export type PublicNavigation = {
  version: number
  status: "draft" | "published"
  updatedLabel: string
  header: PublicNavigationItem[]
  mobile: PublicNavigationItem[]
  footer: PublicNavigationItem[]
}

export type EditorRecord = {
  id: string
  kind: "home" | "landing" | "category" | "profile" | "article"
  internalName: string
  publicTitle: string
  slug: string
  parent: string
  parentNodeId?: string | null
  sortOrder?: number
  hasPublishedRevision?: boolean
  url: string
  status: ContentStatus
  revisionState?: "draft" | "review" | "approved" | "scheduled" | "published" | "superseded" | "archived"
  version: number
  owner: string
  source: SourceKind
  updatedLabel: string
  reviewLabel: string
  seoChecks: { passed: number; warnings: number; blockers: number }
  sections: SectionConfig[]
  description: string
  seoTitle: string
  seoDescription: string
  indexPolicy: "index_follow" | "noindex_follow" | "noindex_nofollow"
  revision?: number
  readonlyCrm?: { entity: string; code: string; status: string; capacity: string; price: string; availability: string }
  hero: HeroConfig
  importedFromCrm?: boolean
}

export type MediaAsset = {
  id: string
  version?: number
  title: string
  filename: string
  status: "ready" | "uploading" | "scanning" | "converting" | "error" | "archived"
  progress: number
  dimensions: string
  size: string
  usageCount: number
  publishedUsage: boolean
  alt: string
  license: string
  dominant: string
  previewUrl?: string
  variants?: { id: string; format: "webp" | "avif" | "original"; width: number | null; height: number | null; byteSize: number; url: string }[]
  usages?: { ownerType: string; ownerId: string; pointer: string; published: boolean }[]
}

export type ReleaseGate = { id: string; label: string; detail: string; state: "passed" | "warning" | "blocked" | "running" }
export type ReleaseRecord = {
  id: string
  title: string
  state: "draft" | "review" | "approved" | "published" | "failed"
  baseReleaseId: string
  author: string
  reviewer: string
  changedRoutes: number
  assets: number
  codeArtifacts: number
  createdLabel: string
  gates: ReleaseGate[]
  changes: { route: string; before: string; after: string; kind: string }[]
  active?: boolean
  activeReleaseId?: string | null
  activeReleaseVersion?: number
  delivery?: { eventId: string; consumer: string; status: "pending" | "processing" | "succeeded" | "failed" | "dead_letter"; attempts: number; deliveryEpoch: number; lastErrorCode: string | null; updatedAt: string }[]
}

export type AnalyticsSummary = {
  period: string
  visitors: number
  views: number
  leads: number
  bookings: number
  paid: number
  channels: { name: string; value: number; percent: number }[]
  pages: { path: string; views: number; cta: number; leads: number }[]
}

export type CodeArtifact = {
  id: string
  name: string
  status: "draft" | "valid" | "failed"
  file: string
  files: { path: string; kind: "folder" | "tsx" | "css" | "json"; changed?: boolean }[]
  source: string
  diff: { before: string; after: string }[]
  gates: ReleaseGate[]
  dependencies: string[]
  editable: boolean
}

export interface CmsRepository {
  readonly mode: "api" | "fixtures"
  getAccess(): Promise<CmsAccess>
  getDashboard(): Promise<CmsDashboard>
  getNodes(query?: CmsNodeQuery): Promise<ContentNode[]>
  getEditor(id: string, kind: EditorRecord["kind"]): Promise<EditorRecord>
  saveEditor(record: EditorRecord, expectedVersion: number): Promise<EditorRecord>
  submitReview(id: string, expectedVersion: number): Promise<EditorRecord>
  returnToDraft(id: string, expectedVersion: number): Promise<EditorRecord>
  approve(id: string, expectedVersion: number): Promise<EditorRecord>
  archive(id: string, expectedVersion: number): Promise<EditorRecord>
  getPublicationPreview(id: string): Promise<CmsPublicationPreview>
  publish(id: string, expectedVersion: number, preview?: CmsPublicationPreview): Promise<EditorRecord>
  getNavigation(): Promise<PublicNavigation>
  saveNavigation(value: PublicNavigation, expectedVersion: number): Promise<PublicNavigation>
  publishNavigation(expectedVersion: number): Promise<PublicNavigation>
  getMedia(): Promise<MediaAsset[]>
  getAsset(id: string): Promise<MediaAsset>
  uploadMedia(file: File): Promise<MediaAsset>
  saveMediaMetadata(asset: MediaAsset): Promise<MediaAsset>
  archiveMedia(id: string, expectedVersion: number): Promise<MediaAsset>
  getReleases(): Promise<ReleaseRecord[]>
  getRelease(id: string): Promise<ReleaseRecord>
  activateRelease(id: string, baseReleaseId: string | null, activeReleaseVersion: number): Promise<ReleaseRecord>
  rollbackRelease(id: string, activeReleaseId: string | null, activeReleaseVersion: number): Promise<ReleaseRecord>
  replayReleaseDelivery(releaseId: string, delivery: NonNullable<ReleaseRecord["delivery"]>[number]): Promise<ReleaseRecord>
  getAnalytics(): Promise<AnalyticsSummary>
  getCodeArtifact(id?: string): Promise<CodeArtifact>
}

export type CmsNodeQuery = { q?: string; kind?: CmsPageKind; status?: "active" | "archived" }
export type CmsAccess = { canViewContent: boolean; canEditContent: boolean; canReviewContent: boolean; canPublishContent: boolean }

export class CmsConflictError extends Error {
  constructor(public readonly serverVersion: number, public readonly requestId?: string) { super("Контент уже изменён в другой сессии") }
}

export class CmsUnavailableError extends Error {
  constructor(feature: string) { super(`${feature}: authoritative API ещё не реализован. Доступен только явный fixture-режим.`) }
}
