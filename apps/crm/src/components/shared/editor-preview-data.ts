export type MarketingAttributionDraft = {
  channel: string
  clientId: string
  maxDialogId: string
  metricaClientId: string
  source: string
  utmCampaign: string
  utmContent: string
  utmMedium: string
  utmSource: string
  utmTerm: string
  vkLeadId: string
}

export function createPreviewMarketing(source: string, utmSource: string): MarketingAttributionDraft {
  return { channel: "site", clientId: "crm_1042_20260824", maxDialogId: "", metricaClientId: "1756038123456789012", source, utmCampaign: "late_summer_2026", utmContent: "hero_family_offer", utmMedium: utmSource.includes("cpc") ? "cpc" : "organic", utmSource, utmTerm: "отдых с семьёй ленобласть", vkLeadId: "vk_9128841" }
}
