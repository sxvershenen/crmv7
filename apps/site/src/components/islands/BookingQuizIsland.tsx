import type { CmsHomeSectionConfig } from "@crm/contracts"
import type { HomepageCommerce } from "../../lib/content/homepage-commerce"
import { BookingQuizSection } from "../../react/components/sections/BookingQuizSection";
import { openPrivacyPolicy, showToast } from "../../lib/site-events";

export function BookingQuizIsland({ config, commerce, fixture = false }: { config: CmsHomeSectionConfig; commerce?: HomepageCommerce | undefined; fixture?: boolean }) {
  return (
    <BookingQuizSection config={config} commerce={commerce} fixture={fixture}
      onOpenPrivacyPolicy={openPrivacyPolicy}
      onToast={showToast}
    />
  );
}

export default BookingQuizIsland;
