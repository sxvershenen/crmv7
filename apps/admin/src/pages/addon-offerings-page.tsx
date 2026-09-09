import type { OfferingEditorGateway } from "@crm/offering-editor"

import { houseOfferingGateway } from "@admin/data/house-offerings-repository"
import { OfferingContentWorkspacePage } from "@admin/pages/offering-content-workspace-page"

export function AddOnOfferingWorkspacePage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  return <OfferingContentWorkspacePage direction="addon" gateway={gateway} />
}
