import { FloatingHelper } from "../../react/components/common/FloatingHelper";
import { openBooking } from "../../lib/site-events";

export function FloatingHelperIsland() {
  return <FloatingHelper onOpenBookingModal={() => openBooking()} />;
}

export default FloatingHelperIsland;
