import { useEffect, useState } from "react"
import { IconAlertTriangle, IconLinkOff } from "@tabler/icons-react"
import { Navigate, useMatch, useNavigate, useParams } from "react-router-dom"

import { LoadingRows, PageFrame, PageState } from "@crm/ui"
import type { InternalOfferingEditor } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"

import { houseOfferingGateway } from "@app/data/house-offerings-repository"

type StayKind = "house" | "campground"
type RedirectState =
  | { status: "loading" }
  | { status: "resolved"; resourceId: string }
  | { status: "invalid"; message: string }
  | { status: "error"; message: string }

/**
 * Retires the standalone CRM stay-offering editor without guessing a resource
 * from a possibly-corrupt binding graph. The Resource dossier remains the only
 * operational editor for house and campground sale terms.
 */
export function StayOfferingResourceRedirectPage({ gateway = houseOfferingGateway }: { gateway?: Pick<OfferingEditorGateway, "getHouseEditor" | "getCampgroundEditor"> }) {
  const { offeringId } = useParams()
  const navigate = useNavigate()
  const kind = useMatch("/offers/campgrounds/:offeringId") ? "campground" : "house"
  const [state, setState] = useState<RedirectState>({ status: "loading" })

  useEffect(() => {
    let active = true
    if (!offeringId) {
      setState({ status: "invalid", message: "Идентификатор предложения отсутствует." })
      return () => { active = false }
    }
    setState({ status: "loading" })
    const load = kind === "campground" ? gateway.getCampgroundEditor(offeringId) : gateway.getHouseEditor(offeringId)
    void load.then((editor) => {
      if (!active) return
      if (!editor) {
        setState({ status: "invalid", message: "Запись не найдена или больше недоступна." })
        return
      }
      const resourceId = resolvePrimaryResourceId(editor, kind)
      setState(resourceId
        ? { status: "resolved", resourceId }
        : { status: "invalid", message: "Нельзя безопасно открыть ресурс: в старых данных нет однозначной связи." })
    }).catch(() => {
      if (active) setState({ status: "error", message: "Не удалось проверить старую ссылку. Редактор не открыт, чтобы не изменить другую запись." })
    })
    return () => { active = false }
  }, [gateway, kind, offeringId])

  const resourceRouteKind = kind === "house" ? "houses" : "camping"
  const listLabel = kind === "house" ? "К списку домиков" : "К списку кемпингов"
  const listPath = `/resources/${resourceRouteKind}`

  if (state.status === "resolved") return <Navigate replace to={`/resources/${resourceRouteKind}/${encodeURIComponent(state.resourceId)}?tab=offering`} />
  if (state.status === "loading") return <PageFrame><div aria-label="Проверка связи предложения" role="status"><LoadingRows count={4} /></div></PageFrame>

  return <PageFrame><PageState actionLabel={listLabel} icon={state.status === "error" ? IconAlertTriangle : IconLinkOff} onAction={() => navigate(listPath, { replace: true })} title={state.status === "error" ? "Старая ссылка не проверена" : "Старая ссылка не ведёт к ресурсу"} tone={state.status === "error" ? "danger" : "warning"}>{state.message}</PageState></PageFrame>
}

function resolvePrimaryResourceId(editor: InternalOfferingEditor, expectedKind: StayKind): string | null {
  if (editor.offering.kind !== expectedKind) return null
  const primaryBindings = editor.bindings.filter((binding) => binding.role === "primary" && binding.target.type === "resource")
  if (primaryBindings.length !== 1) return null

  const expectedResourceKinds = expectedKind === "house"
    ? new Set(["house", "houses"])
    : new Set(["campground", "camping", "campground_owned_tent", "campground_own_tent_area"])
  const targets = editor.bindingTargets.filter((target) =>
    target.id === primaryBindings[0]!.target.id
    && expectedResourceKinds.has(target.kind)
    && !target.archived,
  )
  return targets.length === 1 ? targets[0]!.id : null
}
