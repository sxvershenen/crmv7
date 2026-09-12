import type { CmsHomeSectionConfig } from "@crm/contracts"
import { ReviewsSection } from "../../react/components/sections/ReviewsSection";

export function ReviewsIsland({ config, fixture = false }: { config: CmsHomeSectionConfig; fixture?: boolean }) {
  return <ReviewsSection config={config} fixture={fixture} />;
}

export default ReviewsIsland;
