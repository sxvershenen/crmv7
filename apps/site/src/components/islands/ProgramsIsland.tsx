import type { CmsHomeSectionConfig, PublicProgramSummary } from "@crm/contracts"
import { ProgramsSection } from "../../react/components/sections/ProgramsSection";
import { openBooking } from "../../lib/site-events";

export function ProgramsIsland({ config, published, fixture = false }: { config: CmsHomeSectionConfig; published?: PublicProgramSummary[] | undefined; fixture?: boolean }) {
  return <ProgramsSection config={config} published={published} fixture={fixture} onOpenBookingModal={openBooking} />;
}

export default ProgramsIsland;
