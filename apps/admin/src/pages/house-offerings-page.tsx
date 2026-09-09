import type { OfferingEditorGateway } from "@crm/offering-editor"

import { houseOfferingGateway } from "@admin/data/house-offerings-repository"
import { OfferingContentWorkspacePage } from "@admin/pages/offering-content-workspace-page"

export function HouseOfferingWorkspacePage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  return <OfferingContentWorkspacePage direction="house" gateway={gateway} />
}
