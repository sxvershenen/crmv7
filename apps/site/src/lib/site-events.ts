import type { HouseItem } from "../react/data/resortData";

/**
 * Browser-only event names used to coordinate independently hydrated islands.
 * The dispatcher deliberately becomes a no-op during Astro SSR.
 */
export const SITE_EVENTS = {
  booking: "site:booking",
  call: "site:call",
  house: "site:house",
  privacy: "site:privacy",
  toast: "site:toast",
  navigate: "site:navigate"
} as const;

export type SiteEventName = (typeof SITE_EVENTS)[keyof typeof SITE_EVENTS];

export interface SiteEventDetails {
  [SITE_EVENTS.booking]: { itemName?: string };
  [SITE_EVENTS.call]: undefined;
  [SITE_EVENTS.house]: { house: HouseItem };
  [SITE_EVENTS.privacy]: undefined;
  [SITE_EVENTS.toast]: { message: string };
  [SITE_EVENTS.navigate]: { sectionId: string };
}

export function emitSiteEvent<TName extends SiteEventName>(
  name: TName,
  detail: SiteEventDetails[TName]
) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function listenForSiteEvent<TName extends SiteEventName>(
  name: TName,
  listener: (detail: SiteEventDetails[TName]) => void
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const eventListener = (event: Event) => {
    listener((event as CustomEvent<SiteEventDetails[TName]>).detail);
  };

  window.addEventListener(name, eventListener);
  return () => window.removeEventListener(name, eventListener);
}

export const openBooking = (itemName?: string) =>
  emitSiteEvent(
    SITE_EVENTS.booking,
    itemName === undefined ? {} : { itemName }
  );

export const openCall = () => emitSiteEvent(SITE_EVENTS.call, undefined);

export const openHouse = (house: HouseItem) =>
  emitSiteEvent(SITE_EVENTS.house, { house });

export const openPrivacyPolicy = () =>
  emitSiteEvent(SITE_EVENTS.privacy, undefined);

export const showToast = (message: string) =>
  emitSiteEvent(SITE_EVENTS.toast, { message });

export const navigateTo = (sectionId: string) =>
  emitSiteEvent(SITE_EVENTS.navigate, { sectionId });
