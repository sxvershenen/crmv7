import type { CmsHomeSectionConfig } from "@crm/contracts"
import { ProgramsSection } from "../../react/components/sections/ProgramsSection";
import { openBooking } from "../../lib/site-events";

export function ProgramsIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <ProgramsSection config={config} onOpenBookingModal={openBooking} />;
}

export default ProgramsIsland;
