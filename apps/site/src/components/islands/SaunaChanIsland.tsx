import type { CmsHomeSectionConfig } from "@crm/contracts"
import { SaunaChanSection } from "../../react/components/sections/SaunaChanSection";
import { navigateTo, openBooking, showToast } from "../../lib/site-events";

export function SaunaChanIsland({ config, fixture = false }: { config: CmsHomeSectionConfig; fixture?: boolean }) {
  return (
    <SaunaChanSection config={config} fixture={fixture}
      onAddAddon={() => navigateTo("quiz")}
      onOpenBookingModal={openBooking}
      onToast={showToast}
    />
  );
}

export default SaunaChanIsland;
