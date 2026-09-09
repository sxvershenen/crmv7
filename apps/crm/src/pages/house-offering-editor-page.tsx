import { useCallback, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { HouseOfferingWorkspace, type HouseOfferingWorkspaceTab, type OfferingEditorGateway } from "@crm/offering-editor"
import type { InternalOfferingEditor } from "@crm/contracts"

import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"

const adminAppBaseUrl = (import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "")

function isTab(value: string | null): value is HouseOfferingWorkspaceTab { return value === "overview" || value === "composition" || value === "pricing" }

export function HouseOfferingEditorPage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  const { offeringId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const navigationGuard = useRef<(() => boolean) | null>(null)
  const tab = isTab(params.get("tab")) ? params.get("tab") as HouseOfferingWorkspaceTab : "overview"
  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" && location.state.from.startsWith("/offers/houses") ? location.state.from : "/offers/houses"
  const closeEditor = useCallback(() => navigate(from), [from, navigate])
  const guardedBack = useCallback(() => {
    if (navigationGuard.current?.() ?? true) closeEditor()
  }, [closeEditor])
  const setNavigationGuard = useCallback((guard: (() => boolean) | null) => { navigationGuard.current = guard }, [])
  const chrome = useMemo(() => ({ idLabel: editor ? `#${editor.offering.code}` : "#offer", onBack: guardedBack, title: editor?.offering.operationalName ?? "Предложение домика" }), [editor, guardedBack])
  useEditorLayoutChrome(chrome)
  const createCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor?.ownerVersions.pricing ?? 1 }), [editor?.ownerVersions.pricing])
  const createSubjectCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: editor?.ownerVersions.subject.aggregateVersion ?? 1 }), [editor?.ownerVersions.subject.aggregateVersion])
  const createAddOnsCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedAddOnsVersion: editor?.ownerVersions.addOnAssignments ?? 1 }), [editor?.ownerVersions.addOnAssignments])
  const editorialHref = useCallback(() => `${adminAppBaseUrl}/offers/houses/${encodeURIComponent(offeringId)}?tab=content`, [offeringId])

  return <HouseOfferingWorkspace
    createCommandMeta={createCommandMeta}
    createSubjectCommandMeta={createSubjectCommandMeta}
    createAddOnsCommandMeta={createAddOnsCommandMeta}
    editorialHref={editorialHref}
    gateway={gateway}
    initialTab={tab}
    offeringId={offeringId}
    onBack={closeEditor}
    onEditorChange={setEditor}
    onNavigationGuardChange={setNavigationGuard}
    onTabChange={(nextTab) => setParams((current) => { const next = new URLSearchParams(current); if (nextTab === "overview") next.delete("tab"); else next.set("tab", nextTab); return next }, { replace: true })}
  />
}
