import { useCallback, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { CampgroundOfferingWorkspace, type CampgroundOfferingWorkspaceTab, type OfferingEditorGateway } from "@crm/offering-editor"
import type { InternalOfferingEditor } from "@crm/contracts"

import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"

const adminAppBaseUrl = (import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "")

function isTab(value: string | null): value is CampgroundOfferingWorkspaceTab { return value === "overview" || value === "composition" || value === "pricing" }

export function CampgroundOfferingEditorPage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  const { offeringId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const navigationGuard = useRef<(() => boolean) | null>(null)
  const tab = isTab(params.get("tab")) ? params.get("tab") as CampgroundOfferingWorkspaceTab : "overview"
  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" && location.state.from.startsWith("/offers/campgrounds") ? location.state.from : "/offers/campgrounds"
  const closeEditor = useCallback(() => navigate(from), [from, navigate])
  const guardedBack = useCallback(() => { if (navigationGuard.current?.() ?? true) closeEditor() }, [closeEditor])
  const chrome = useMemo(() => ({ idLabel: editor ? `#${editor.offering.code}` : "#offer", onBack: guardedBack, title: editor?.offering.operationalName ?? "Предложение кемпинга" }), [editor, guardedBack])
  useEditorLayoutChrome(chrome)
  const createCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor?.ownerVersions.pricing ?? 1 }), [editor?.ownerVersions.pricing])
  const createSubjectCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: editor?.ownerVersions.subject.aggregateVersion ?? 1 }), [editor?.ownerVersions.subject.aggregateVersion])
  const createAddOnsCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedAddOnsVersion: editor?.ownerVersions.addOnAssignments ?? 1 }), [editor?.ownerVersions.addOnAssignments])
  const editorialHref = useCallback((nodeId: string) => `${adminAppBaseUrl}/offers/campgrounds/${encodeURIComponent(offeringId)}?tab=content&node=${encodeURIComponent(nodeId)}`, [offeringId])

  return <CampgroundOfferingWorkspace createAddOnsCommandMeta={createAddOnsCommandMeta} createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} editorialHref={editorialHref} gateway={gateway} initialTab={tab} offeringId={offeringId} onBack={closeEditor} onEditorChange={setEditor} onNavigationGuardChange={(guard) => { navigationGuard.current = guard }} onTabChange={(nextTab) => setParams((current) => { const next = new URLSearchParams(current); if (nextTab === "overview") next.delete("tab"); else next.set("tab", nextTab); return next }, { replace: true })} />
}
