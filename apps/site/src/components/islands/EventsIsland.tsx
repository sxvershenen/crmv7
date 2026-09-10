import type { CmsHomeSectionConfig } from "@crm/contracts"
import { EventsSection } from "../../react/components/sections/EventsSection";
import { openBooking } from "../../lib/site-events";

export function EventsIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <EventsSection config={config} onOpenBookingModal={openBooking} />;
}

export default EventsIsland;
