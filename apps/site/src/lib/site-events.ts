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
  promo: "site:promo",
  toast: "site:toast",
  navigate: "site:navigate"
} as const;

export type SiteEventName = (typeof SITE_EVENTS)[keyof typeof SITE_EVENTS];

export interface SiteEventDetails {
  [SITE_EVENTS.booking]: { itemName?: string };
  [SITE_EVENTS.call]: undefined;
  [SITE_EVENTS.house]: { house: HouseItem };
  [SITE_EVENTS.privacy]: undefined;
  [SITE_EVENTS.promo]: { code: string };
  [SITE_EVENTS.toast]: { message: string };
  [SITE_EVENTS.navigate]: { sectionId: string };
}

interface PendingSiteEvent<TName extends SiteEventName = SiteEventName> {
  name: TName;
  detail: SiteEventDetails[TName];
}

interface SiteEventRuntime {
  listenerCounts: Map<SiteEventName, number>;
  pending: PendingSiteEvent[];
}

type SiteEventWindow = Window & {
  __SVISTOPLYASOVO_SITE_EVENTS__?: SiteEventRuntime;
};

function getSiteEventRuntime(): SiteEventRuntime {
  const runtimeWindow = window as SiteEventWindow;
  runtimeWindow.__SVISTOPLYASOVO_SITE_EVENTS__ ??= {
    listenerCounts: new Map(),
    pending: [],
  };
  return runtimeWindow.__SVISTOPLYASOVO_SITE_EVENTS__;
}

export function emitSiteEvent<TName extends SiteEventName>(
  name: TName,
  detail: SiteEventDetails[TName]
) {
  if (typeof window === "undefined") {
    return;
  }

  const runtime = getSiteEventRuntime();
  if ((runtime.listenerCounts.get(name) ?? 0) === 0) {
    runtime.pending.push({ name, detail } as PendingSiteEvent);
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

  const runtime = getSiteEventRuntime();
  window.addEventListener(name, eventListener);
  runtime.listenerCounts.set(name, (runtime.listenerCounts.get(name) ?? 0) + 1);

  const waiting = runtime.pending.filter((event) => event.name === name);
  runtime.pending = runtime.pending.filter((event) => event.name !== name);
  waiting.forEach((event) => {
    window.dispatchEvent(new CustomEvent(event.name, { detail: event.detail }));
  });

  return () => {
    window.removeEventListener(name, eventListener);
    const remainingListeners = Math.max(0, (runtime.listenerCounts.get(name) ?? 1) - 1);
    if (remainingListeners === 0) {
      runtime.listenerCounts.delete(name);
    } else {
      runtime.listenerCounts.set(name, remainingListeners);
    }
  };
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

export const applyPromo = (code: string) =>
  emitSiteEvent(SITE_EVENTS.promo, { code });

export const showToast = (message: string) =>
  emitSiteEvent(SITE_EVENTS.toast, { message });

export const navigateTo = (sectionId: string) =>
  emitSiteEvent(SITE_EVENTS.navigate, { sectionId });
