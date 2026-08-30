import { useCallback, useEffect, useState } from "react";
import { MobileDrawer } from "../../react/components/navigation/MobileDrawer";
import { MobileHeader } from "../../react/components/navigation/MobileHeader";
import { MobileNavbar } from "../../react/components/navigation/MobileNavbar";
import { Sidebar } from "../../react/components/navigation/Sidebar";
import {
  SITE_EVENTS,
  listenForSiteEvent,
  openBooking,
  openCall
} from "../../lib/site-events";

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

export function NavigationIsland() {
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
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      />
      <MobileHeader
        onOpenCallModal={openCall}
        onOpenBookingModal={openBooking}
        onNavigate={handleNavigate}
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
      />
    </>
  );
}

export default NavigationIsland;
