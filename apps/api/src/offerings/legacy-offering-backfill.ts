export type LegacyResourceForOffering = Readonly<{
  id: string
  code: string
  kind: string
  name: string
  capacityMode: string
  capacityTotal: number
  settings: Record<string, unknown>
  archived: boolean
  alreadyBound: boolean
}>

export type LegacyProgramForOffering = Readonly<{
  id: string
  code: string
  name: string
  basePriceAmount: number
  currency: string
  publication: string
  archived: boolean
  alreadyBound: boolean
}>

export type LegacyOfferingBackfillItem = Readonly<{
  sourceType: "resource" | "program_template"
  sourceId: string
  sourceCode: string
  sourceName: string
  proposedKind: "house" | "campground" | "addon" | "venue" | "program" | null
  proposedSubtype: "owned_tent" | "own_tent_area" | null
  disposition: "ready" | "review" | "skip_existing" | "skip_archived"
  signals: Readonly<Record<string, string | number | boolean | null>>
  reasons: readonly string[]
}>

export type LegacyOfferingBackfillReport = Readonly<{
  mode: "dry_run"
  generatedAt: string
  writeCount: 0
  summary: Readonly<Record<LegacyOfferingBackfillItem["disposition"], number>>
  globalBlockers: readonly string[]
  items: readonly LegacyOfferingBackfillItem[]
}>

const RESOURCE_KIND_MAPPING: Readonly<Record<string, LegacyOfferingBackfillItem["proposedKind"]>> = {
  house: "house",
  houses: "house",
  camping: "campground",
  campground: "campground",
  bath: "addon",
  addon: "addon",
  venue: "venue",
  venues: "venue",
}

/**
 * Produces an evidence-only migration inventory. It never turns showOnSite into
 * publication eligibility and never guesses the commercial basis of a legacy
 * program base price.
 */
export function buildLegacyOfferingBackfillReport(input: Readonly<{
  resources: readonly LegacyResourceForOffering[]
  programs: readonly LegacyProgramForOffering[]
  activeBusinessCalendarCount: number
  generatedAt: string
}>): LegacyOfferingBackfillReport {
  const items = [
    ...input.resources.map(resourceItem),
    ...input.programs.map(programItem),
  ].sort((left, right) => left.sourceType.localeCompare(right.sourceType) || left.sourceCode.localeCompare(right.sourceCode))
  const summary = { ready: 0, review: 0, skip_existing: 0, skip_archived: 0 }
  for (const item of items) summary[item.disposition] += 1
  return {
    mode: "dry_run",
    generatedAt: input.generatedAt,
    writeCount: 0,
    summary,
    globalBlockers: input.activeBusinessCalendarCount === 1
      ? []
      : [`Требуется ровно один выбранный active business calendar; найдено: ${input.activeBusinessCalendarCount}`],
    items,
  }
}

function resourceItem(resource: LegacyResourceForOffering): LegacyOfferingBackfillItem {
  const normalizedKind = resource.kind.trim().toLocaleLowerCase("ru-RU")
  const proposedKind = RESOURCE_KIND_MAPPING[normalizedKind] ?? null
  const showOnSite = resource.settings.showOnSite === true
  const subtype = proposedKind === "campground"
    ? resource.capacityMode === "shared" ? "own_tent_area" : resource.capacityMode === "fixed" ? "owned_tent" : null
    : null
  const reasons: string[] = []
  if (showOnSite) reasons.push("showOnSite сохранён только как migration signal; он не даёт права публикации")
  if (!proposedKind) reasons.push(`Неизвестный legacy Resource.kind: ${resource.kind}`)
  if (proposedKind === "campground" && !subtype) reasons.push(`Нельзя вывести campground subtype из capacityMode=${resource.capacityMode}`)
  if (proposedKind === "addon" && normalizedKind !== "addon") reasons.push("Нужно подтвердить, что legacy bath продаётся как переиспользуемый add-on")
  if (["houses", "venues"].includes(normalizedKind)) reasons.push(`Legacy alias ${resource.kind} требует подтверждения нормализации`)
  const disposition = resource.archived ? "skip_archived"
    : resource.alreadyBound ? "skip_existing"
      : reasons.some((reason) => !reason.startsWith("showOnSite")) ? "review"
        : proposedKind ? "ready" : "review"
  return {
    sourceType: "resource", sourceId: resource.id, sourceCode: resource.code, sourceName: resource.name,
    proposedKind, proposedSubtype: subtype, disposition,
    signals: {
      legacyKind: resource.kind, capacityMode: resource.capacityMode,
      capacityTotal: resource.capacityTotal, showOnSite,
    },
    reasons,
  }
}

function programItem(program: LegacyProgramForOffering): LegacyOfferingBackfillItem {
  const reasons = [
    "Нужно подтвердить pricing basis legacy basePrice: per_person, flat_package или только display seed",
  ]
  if (program.publication === "published") reasons.push("Legacy publication — только migration signal; требуется отдельная offering/public-profile readiness")
  const disposition = program.archived ? "skip_archived" : program.alreadyBound ? "skip_existing" : "review"
  return {
    sourceType: "program_template", sourceId: program.id, sourceCode: program.code, sourceName: program.name,
    proposedKind: "program", proposedSubtype: null, disposition,
    signals: {
      basePriceAmount: program.basePriceAmount, currency: program.currency,
      legacyPublication: program.publication,
    },
    reasons,
  }
}
