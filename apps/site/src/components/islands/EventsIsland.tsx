import { EventsSection } from "../../react/components/sections/EventsSection";
import { openBooking } from "../../lib/site-events";

export function EventsIsland() {
  return <EventsSection onOpenBookingModal={openBooking} />;
}

export default EventsIsland;
