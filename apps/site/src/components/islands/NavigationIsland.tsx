import { useCallback, useEffect, useState } from "react";
import type { SiteNavigationConfig } from "@crm/site-ui";
import { MobileDrawer } from "../../react/components/navigation/MobileDrawer";
import { MobileNavbar } from "../../react/components/navigation/MobileNavbar";
import { Sidebar } from "../../react/components/navigation/Sidebar";
import {
  SITE_EVENTS,
  listenForSiteEvent,
  openBooking,
  openCall
} from "../../lib/site-events";
import { DEFAULT_PUBLIC_NAVIGATION } from "../../data/publicContentDefaults";

const TRACKED_SECTIONS = [
  "hero",
  "events",
  "houses",
  "sauna",
  "programs",
  "venues",
  "reviews",
  "map",
  "location",
  "quiz"
];

export function NavigationIsland({ navigation }: { navigation?: SiteNavigationConfig }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  const handleNavigate = useCallback((sectionId: string) => {
    if (!sectionId) {
      return;
    }

    setActiveSection(sectionId);
    setIsMobileDrawerOpen(false);

    const section = document.getElementById(sectionId);
    if (section) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      return;
    }

    window.location.assign(`/#${encodeURIComponent(sectionId)}`);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(isSidebarCollapsed);

    return () => {
      delete document.documentElement.dataset.sidebarCollapsed;
    };
  }, [isSidebarCollapsed]);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.navigate, ({ sectionId }) => {
    handleNavigate(sectionId);
  }), [handleNavigate]);

  useEffect(() => {
    let animationFrame: number | undefined;

    const updateActiveSection = () => {
      animationFrame = undefined;
      const scrollPosition = window.scrollY + 200;
      const currentSection = TRACKED_SECTIONS.find((sectionId) => {
        const section = document.getElementById(sectionId);

        return section
          ? scrollPosition >= section.offsetTop && scrollPosition < section.offsetTop + section.offsetHeight
          : false;
      });

      if (currentSection) {
        setActiveSection((previous) => previous === currentSection ? previous : currentSection);
      }
    };

    const handleScroll = () => {
      if (animationFrame === undefined) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  useEffect(() => {
    const handleStaticNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[data-site-action="navigate"]')
        : null;
      const sectionId = target?.dataset.siteTarget;

      if (!target || !sectionId) {
        return;
      }

      event.preventDefault();
      handleNavigate(sectionId);
    };

    document.addEventListener("click", handleStaticNavigation);
    return () => document.removeEventListener("click", handleStaticNavigation);
  }, [handleNavigate]);

  return (
    <>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        onOpenBookingModal={openBooking}
        onOpenCallModal={openCall}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        brand={(navigation ?? DEFAULT_PUBLIC_NAVIGATION).brand}
        items={(navigation ?? DEFAULT_PUBLIC_NAVIGATION).items}
        configuredColors={Boolean(navigation)}
      />
      <MobileNavbar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenCallModal={openCall}
        onOpenBookingModal={openBooking}
        onToggleMobileMenu={() => setIsMobileDrawerOpen(true)}
      />
      <MobileDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        onNavigate={handleNavigate}
        onOpenBookingModal={() => openBooking()}
        onOpenCallModal={openCall}
        {...(navigation ? { navigation } : {})}
      />
    </>
  );
}

export default NavigationIsland;
