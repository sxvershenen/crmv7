import { ProgramsSection } from "../../react/components/sections/ProgramsSection";
import { openBooking } from "../../lib/site-events";

export function ProgramsIsland() {
  return <ProgramsSection onOpenBookingModal={openBooking} />;
}

export default ProgramsIsland;
