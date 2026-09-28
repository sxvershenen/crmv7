import { FloatingHelper } from "../../react/components/common/FloatingHelper";
import type { CmsFooterDetails } from "@crm/contracts";

export function FloatingHelperIsland({ contactDetails }: { contactDetails?: CmsFooterDetails }) {
  return <FloatingHelper {...(contactDetails ? { contactDetails } : {})} />;
}

export default FloatingHelperIsland;
