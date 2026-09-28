import type { CmsFooterDetails, CmsHomeSectionConfig } from "@crm/contracts"
import { FaqLocationSection } from "../../react/components/sections/FaqLocationSection";
import { openCall } from "../../lib/site-events";

export function FaqLocationIsland({ config, contactDetails }: { config: CmsHomeSectionConfig; contactDetails?: CmsFooterDetails }) {
  return <FaqLocationSection config={config} {...(contactDetails ? { contactDetails } : {})} onOpenCallModal={openCall} />;
}

export default FaqLocationIsland;
