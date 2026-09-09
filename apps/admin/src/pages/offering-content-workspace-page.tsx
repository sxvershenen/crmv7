import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconFileText } from "@tabler/icons-react"
import { useParams } from "react-router-dom"

import type { InternalOfferingEditor } from "@crm/contracts"
import { offeringEditorErrorMessage, type OfferingEditorGateway } from "@crm/offering-editor"
import { LoadingRows, PageFrame, PageState } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { ContentEditorPage } from "@admin/pages/content-editor-page"

type EditorialDirection = "house" | "campground" | "addon"

const directionCopy = {
  house: { empty: "Домик не выбран", label: "домика", list: "/content/tree", load: "Не удалось найти страницу домика." },
  campground: { empty: "Кемпинг не выбран", label: "кемпинга", list: "/content/tree", load: "Не удалось найти страницу кемпинга." },
  addon: { empty: "Дополнительная услуга не выбрана", label: "дополнительной услуги", list: "/content/tree", load: "Не удалось найти страницу дополнительной услуги." },
} as const

const crmAppBaseUrl = (import.meta.env.VITE_CRM_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5173" : "/crm")).replace(/\/$/, "")

export function OfferingContentWorkspacePage({ direction, gateway }: { direction: EditorialDirection; gateway: OfferingEditorGateway }) {
  const { offeringId } = useParams()
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const copy = directionCopy[direction]
  const load = useCallback(async () => {
    if (!offeringId) return
    setLoading(true)
    setError(null)
    try {
      const next = direction === "house"
        ? await gateway.getHouseEditor(offeringId)
        : direction === "campground"
          ? await gateway.getCampgroundEditor(offeringId)
          : await gateway.getAddOnEditor(offeringId)
      setEditor(next)
    } catch (reason) {
      setError(offeringEditorErrorMessage(reason, copy.load))
    } finally {
      setLoading(false)
    }
  }, [copy.load, direction, gateway, offeringId])

  useEffect(() => { void load() }, [load])

  if (!offeringId) return <PageFrame><PageHeading title={copy.empty} /></PageFrame>
  if (error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Страница недоступна" tone="danger">{error}</PageState></PageFrame>
  if (loading) return <div aria-label={`Загрузка страницы ${copy.label}`} className="p-4" role="status"><LoadingRows count={7} /></div>
  if (!editor) return <PageFrame><PageState icon={IconFileText} title="Страница не найдена">Возможно, ресурс удалён или у вас больше нет доступа.</PageState></PageFrame>
  if (!editor.editorial) return <PageFrame><PageState icon={IconFileText} title="Черновик страницы не подготовлен">Создайте или пересохраните ресурс в CRM — система подготовит связанную страницу автоматически.</PageState></PageFrame>
  if (direction === "addon" && editor.editorial.node.kind !== "addon_detail") return <PageFrame><PageState icon={IconAlertTriangle} title="Связана страница другого типа" tone="danger">Редактор не открыл материал, чтобы не изменить чужую страницу.</PageState></PageFrame>

  const crmHref = direction === "house"
    ? `${crmAppBaseUrl}/offers/houses/${encodeURIComponent(offeringId)}`
    : direction === "campground"
      ? `${crmAppBaseUrl}/offers/campgrounds/${encodeURIComponent(offeringId)}`
      : `${crmAppBaseUrl}/offers/addons/${encodeURIComponent(offeringId)}`

  return <ContentEditorPage
    externalEditHref={crmHref}
    kind="profile"
    nodeId={editor.editorial.node.id}
    publicationGate={editor.editorial.publication}
    returnLabel="К страницам сайта"
    returnTo={copy.list}
    workspace="offering"
    workspaceSubjectLabel={copy.label}
  />
}
