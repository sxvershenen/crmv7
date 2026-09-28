import type { CmsHomeSectionConfig, PublicAddOnSummary } from "@crm/contracts"
import { SaunaChanSection } from "../../react/components/sections/SaunaChanSection";
import { navigateTo, openBooking, showToast } from "../../lib/site-events";

export function SaunaChanIsland({ config, published, fixture = false }: { config: CmsHomeSectionConfig; published?: PublicAddOnSummary[]; fixture?: boolean }) {
  return (
    <SaunaChanSection config={config} {...(published ? { published } : {})} fixture={fixture}
      onAddAddon={() => navigateTo("quiz")}
      onOpenBookingModal={openBooking}
      onToast={showToast}
    />
  );
}

export default SaunaChanIsland;
