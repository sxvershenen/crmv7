import type { CmsHomeSectionConfig } from "@crm/contracts"
import { BookingQuizSection } from "../../react/components/sections/BookingQuizSection";
import { openPrivacyPolicy, showToast } from "../../lib/site-events";

export function BookingQuizIsland({ config }: { config: CmsHomeSectionConfig }) {
  return (
    <BookingQuizSection config={config}
      onOpenPrivacyPolicy={openPrivacyPolicy}
      onToast={showToast}
    />
  );
}

export default BookingQuizIsland;
