import type { CmsHomeSectionConfig } from "@crm/contracts"
import { SaunaChanSection } from "../../react/components/sections/SaunaChanSection";
import { navigateTo, openBooking, showToast } from "../../lib/site-events";

export function SaunaChanIsland({ config }: { config: CmsHomeSectionConfig }) {
  return (
    <SaunaChanSection config={config}
      onAddAddon={() => navigateTo("quiz")}
      onOpenBookingModal={openBooking}
      onToast={showToast}
    />
  );
}

export default SaunaChanIsland;
