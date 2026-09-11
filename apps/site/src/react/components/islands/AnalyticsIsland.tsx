import { useEffect } from "react";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  type AnalyticsConsentChangedDetail,
  trackAnalyticsClick,
  trackPageView,
} from "../../../lib/analytics-client";

export function AnalyticsIsland() {
  useEffect(() => {
    let pageViewSent = false;

    const sendPageViewOnce = () => {
      if (!pageViewSent && trackPageView()) {
        pageViewSent = true;
      }
    };

    const handleConsentChanged = (event: Event) => {
      const { state } = (event as CustomEvent<AnalyticsConsentChangedDetail>).detail;
      if (state === "analytics") {
        sendPageViewOnce();
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-id]")
        : null;
      const actionId = target?.dataset.analyticsId;
      if (!target || !actionId) {
        return;
      }

      trackAnalyticsClick(actionId, target.tagName.toLowerCase());
    };

    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChanged);
    document.addEventListener("click", handleClick);
    sendPageViewOnce();

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChanged);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}

export default AnalyticsIsland;
