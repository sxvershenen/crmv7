import type { CmsHomeSectionConfig } from "@crm/contracts"
import { ReviewsSection } from "../../react/components/sections/ReviewsSection";

export function ReviewsIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <ReviewsSection config={config} />;
}

export default ReviewsIsland;
