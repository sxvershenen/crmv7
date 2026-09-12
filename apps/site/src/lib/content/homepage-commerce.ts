import type { PublicAddOnSummary, PublicHouseSummary, PublicOfferingSummary, PublicProgramSummary, PublicVenueSummary } from "@crm/contracts"
import type { HouseItem } from "../../data/resortData"

export interface HomepageCommerce {
  houses: PublicHouseSummary[]
  programs: PublicProgramSummary[]
  venues: PublicVenueSummary[]
  addons: PublicAddOnSummary[]
}

export type HomepageHouse = Omit<HouseItem, "priceFrom"> & {
  priceFrom: number | null
  publicOffering?: PublicHouseSummary
}

export function offeringPriceLabel(offering: Pick<PublicOfferingSummary, "price" | "currency">): string {
  if (offering.price.mode === "request") return "По запросу"
  const amount = new Intl.NumberFormat("ru-RU", { style: "currency", currency: offering.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(offering.price.amount.amountMinor / 100)
  return `${offering.price.mode === "from" ? "от " : ""}${amount}`
}

export function homepageHouse(offering: PublicHouseSummary): HomepageHouse {
  return {
    id: offering.offeringId, title: offering.title, undertitle: "", description: offering.summary ?? "", detailedDescription: offering.summary ?? "",
    capacity: String(offering.fulfillment.capacityTotal), capacityNumber: offering.fulfillment.capacityTotal,
    priceFrom: offering.price.mode === "request" ? null : offering.price.amount.amountMinor / 100,
    photos: [], perks: [], availability: [], specs: [], publicOffering: offering,
  }
}
