import { useCallback, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import type { AddOnUsageSummary, InternalOfferingEditor } from "@crm/contracts"
import { AddOnOfferingWorkspace, type AddOnOfferingWorkspaceTab, type OfferingEditorGateway } from "@crm/offering-editor"

import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"

const adminAppBaseUrl = (import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "")
function isTab(value: string | null): value is AddOnOfferingWorkspaceTab { return value === "overview" || value === "terms" || value === "pricing" || value === "usage" }

export function AddOnOfferingEditorPage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  const { offeringId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const navigationGuard = useRef<(() => boolean) | null>(null)
  const tab = isTab(params.get("tab")) ? params.get("tab") as AddOnOfferingWorkspaceTab : "overview"
  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" && location.state.from.startsWith("/offers/addons") ? location.state.from : "/offers/addons"
  const closeEditor = useCallback(() => navigate(from), [from, navigate])
  const guardedBack = useCallback(() => { if (navigationGuard.current?.() ?? true) closeEditor() }, [closeEditor])
  useEditorLayoutChrome(useMemo(() => ({ idLabel: "Доп и услуга", onBack: guardedBack, title: editor?.offering.operationalName ?? "Доп и услуга" }), [editor?.offering.operationalName, guardedBack]))
  const createCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor?.ownerVersions.pricing ?? 1 }), [editor?.ownerVersions.pricing])
  const createSubjectCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: editor?.ownerVersions.subject.aggregateVersion ?? 1 }), [editor?.ownerVersions.subject.aggregateVersion])
  const editorialHref = useCallback((nodeId: string) => `${adminAppBaseUrl}/offers/addons/${encodeURIComponent(offeringId)}?tab=content&node=${encodeURIComponent(nodeId)}`, [offeringId])
  const usageHref = useCallback((usage: AddOnUsageSummary) => `/offers/${usage.parentOffering.kind === "house" ? "houses" : usage.parentOffering.kind === "campground" ? "campgrounds" : usage.parentOffering.kind === "event_service" ? "event-services" : `${usage.parentOffering.kind}s`}/${encodeURIComponent(usage.parentOffering.id)}`, [])

  return <AddOnOfferingWorkspace createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} editorialHref={editorialHref} gateway={gateway} initialTab={tab} offeringId={offeringId} onBack={closeEditor} onEditorChange={setEditor} onNavigationGuardChange={(guard) => { navigationGuard.current = guard }} onTabChange={(nextTab) => setParams((current) => { const next = new URLSearchParams(current); if (nextTab === "overview") next.delete("tab"); else next.set("tab", nextTab); return next }, { replace: true })} usageHref={usageHref} />
}
