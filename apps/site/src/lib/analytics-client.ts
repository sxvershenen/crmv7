import type {
  AnalyticsEventBatch,
  ClientAnalyticsEvent,
} from "@crm/contracts";

export type AnalyticsConsentState = ClientAnalyticsEvent["consent"];

export const ANALYTICS_CONSENT_STORAGE_KEY = "svistoplyasovo.analytics-consent.v1";
export const ANALYTICS_CONSENT_POLICY_VERSION = "v1";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "site:analytics-consent-changed";

const ANALYTICS_ENDPOINT = "/api/public/v1/analytics/events";
const ANALYTICS_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

type StoredAnalyticsConsentState = Extract<AnalyticsConsentState, "analytics" | "denied">;

interface StoredAnalyticsConsent {
  state: StoredAnalyticsConsentState;
  policyVersion: typeof ANALYTICS_CONSENT_POLICY_VERSION;
}

export interface AnalyticsConsentChangedDetail {
  state: AnalyticsConsentState;
}

function isStoredConsent(value: unknown): value is StoredAnalyticsConsent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredAnalyticsConsent>;
  return candidate.policyVersion === ANALYTICS_CONSENT_POLICY_VERSION
    && (candidate.state === "analytics" || candidate.state === "denied");
}

export function getAnalyticsConsentState(): AnalyticsConsentState {
  if (typeof window === "undefined") {
    return "unknown";
  }

  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (!stored) {
      return "unknown";
    }

    const parsed: unknown = JSON.parse(stored);
    return isStoredConsent(parsed) ? parsed.state : "unknown";
  } catch {
    return "unknown";
  }
}

function dispatchConsentChanged(state: AnalyticsConsentState) {
  window.dispatchEvent(new CustomEvent<AnalyticsConsentChangedDetail>(
    ANALYTICS_CONSENT_CHANGED_EVENT,
    { detail: { state } },
  ));
}

function storeConsent(state: StoredAnalyticsConsentState): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const value: StoredAnalyticsConsent = {
      state,
      policyVersion: ANALYTICS_CONSENT_POLICY_VERSION,
    };
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, JSON.stringify(value));
    dispatchConsentChanged(state);
    return true;
  } catch {
    return false;
  }
}

export function denyAnalyticsConsent(): boolean {
  return storeConsent("denied");
}

export function grantAnalyticsConsent(): boolean {
  return storeConsent("analytics");
}

function currentPath(): string | null {
  const path = window.location.pathname;
  return path.length > 0
    && path.length <= 2048
    && path.startsWith("/")
    && !path.startsWith("//")
    && !path.includes("?")
    && !path.includes("#")
    ? path
    : null;
}

function referrerOrigin(): string | null {
  if (!document.referrer) {
    return null;
  }

  try {
    const origin = new URL(document.referrer).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function createEvent(
  eventName: ClientAnalyticsEvent["eventName"],
  consent: ClientAnalyticsEvent["consent"],
  purpose: ClientAnalyticsEvent["purpose"],
  properties: ClientAnalyticsEvent["properties"],
): ClientAnalyticsEvent | null {
  const path = currentPath();
  if (!path) {
    return null;
  }

  try {
    return {
      eventId: window.crypto.randomUUID(),
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      eventName,
      consent,
      purpose,
      context: {
        path,
        pageNodeId: null,
        releaseId: null,
        referrer: referrerOrigin(),
      },
      properties,
    };
  } catch {
    return null;
  }
}

function sendEvent(event: ClientAnalyticsEvent | null): boolean {
  if (!event) {
    return false;
  }

  const body: AnalyticsEventBatch = { events: [event] };
  try {
    void window.fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export function trackPageView(): boolean {
  if (getAnalyticsConsentState() !== "analytics") {
    return false;
  }

  return sendEvent(createEvent(
    "page_view",
    "analytics",
    "analytics",
    { kind: "page_view" },
  ));
}

export function trackAnalyticsClick(actionId: string, component: string): boolean {
  if (getAnalyticsConsentState() !== "analytics"
    || actionId.length > 120
    || !ANALYTICS_ID_PATTERN.test(actionId)
    || component.length === 0
    || component.length > 120) {
    return false;
  }

  return sendEvent(createEvent(
    "cta_clicked",
    "analytics",
    "analytics",
    { kind: "action", actionId, component },
  ));
}

export function revokeAnalyticsConsent(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  let removed = false;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    removed = true;
  } catch {
    // The in-page event still disables analytics for the current document.
  }

  dispatchConsentChanged("denied");
  sendEvent(createEvent(
    "consent_changed",
    "denied",
    "essential",
    {
      kind: "consent",
      state: "denied",
      policyVersion: ANALYTICS_CONSENT_POLICY_VERSION,
    },
  ));
  return removed;
}
