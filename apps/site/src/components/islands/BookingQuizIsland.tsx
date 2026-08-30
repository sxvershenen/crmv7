import { BookingQuizSection } from "../../react/components/sections/BookingQuizSection";
import { openPrivacyPolicy, showToast } from "../../lib/site-events";

export function BookingQuizIsland() {
  return (
    <BookingQuizSection
      onOpenPrivacyPolicy={openPrivacyPolicy}
      onToast={showToast}
    />
  );
}

export default BookingQuizIsland;
