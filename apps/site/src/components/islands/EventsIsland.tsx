import type { CmsHomeSectionConfig, PublicProgramSummary } from "@crm/contracts"
import { EventsSection } from "../../react/components/sections/EventsSection";
import { openBooking } from "../../lib/site-events";

export function EventsIsland({ config, published, fixture = false }: { config: CmsHomeSectionConfig; published?: PublicProgramSummary[] | undefined; fixture?: boolean }) {
  return <EventsSection config={config} published={published} fixture={fixture} onOpenBookingModal={openBooking} />;
}

export default EventsIsland;
