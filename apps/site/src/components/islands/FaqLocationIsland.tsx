import type { CmsHomeSectionConfig } from "@crm/contracts"
import { FaqLocationSection } from "../../react/components/sections/FaqLocationSection";
import { openCall } from "../../lib/site-events";

export function FaqLocationIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <FaqLocationSection config={config} onOpenCallModal={openCall} />;
}

export default FaqLocationIsland;
