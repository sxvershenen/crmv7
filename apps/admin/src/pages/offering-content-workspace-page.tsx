import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconFileText } from "@tabler/icons-react"
import { useParams } from "react-router-dom"

import type { InternalOfferingEditor } from "@crm/contracts"
import { offeringEditorErrorMessage, type OfferingEditorGateway } from "@crm/offering-editor"
import { LoadingRows, PageFrame, PageState } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { crmAppBaseUrl } from "@admin/lib/crm-url"
import { ContentEditorPage } from "@admin/pages/content-editor-page"

type EditorialDirection = "house" | "campground" | "addon"

const directionCopy = {
  house: { empty: "Домик не выбран", label: "домика", list: "/content/tree", load: "Не удалось найти страницу домика." },
  campground: { empty: "Кемпинг не выбран", label: "кемпинга", list: "/content/tree", load: "Не удалось найти страницу кемпинга." },
  addon: { empty: "Дополнительная услуга не выбрана", label: "дополнительной услуги", list: "/content/tree", load: "Не удалось найти страницу дополнительной услуги." },
} as const

export function OfferingContentWorkspacePage({ direction, gateway }: { direction: EditorialDirection; gateway: OfferingEditorGateway }) {
  const { user } = useAdminAuthSession()
  const { offeringId } = useParams()
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [repairing, setRepairing] = useState(false)
  const [repairError, setRepairError] = useState<string | null>(null)
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
  const canPreparePage = direction !== "addon" && user.capabilities.canEdit && user.capabilities.canEditContent && !repairing
  const preparePage = () => {
    if (!offeringId || !canPreparePage) return
    setRepairing(true)
    setRepairError(null)
    void cmsRepository.repairOfferingEditorialLink(offeringId).then(load).catch((reason: unknown) => setRepairError(offeringEditorErrorMessage(reason, "Не удалось подготовить страницу"))).finally(() => setRepairing(false))
  }

  if (!offeringId) return <PageFrame><PageHeading title={copy.empty} /></PageFrame>
  if (error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Страница недоступна" tone="danger">{error}</PageState></PageFrame>
  if (loading) return <div aria-label={`Загрузка страницы ${copy.label}`} className="p-4" role="status"><LoadingRows count={7} /></div>
  if (!editor) return <PageFrame><PageState icon={IconFileText} title="Страница не найдена">Возможно, ресурс удалён или у вас больше нет доступа.</PageState></PageFrame>
  if (!editor.editorial) return <PageFrame><PageState {...(canPreparePage ? { actionLabel: "Подготовить страницу" } : {})} icon={IconFileText} onAction={preparePage} title="Черновик страницы не подготовлен">{repairError ?? "Подготовим черновик из записи CRM. Проверьте текст и адрес перед публикацией."}</PageState></PageFrame>
  const expectedNodeKind = direction === "addon" ? "addon_detail" : "resource_detail"
  if (editor.editorial.node.kind !== expectedNodeKind) return <PageFrame><PageState icon={IconAlertTriangle} title="Связана страница другого типа" tone="danger">Редактор не открыл материал, чтобы не изменить чужую страницу.</PageState></PageFrame>
  const needsRepair = direction !== "addon" && editor.editorial.publication.blockers.some((blocker) => blocker === "public_profile_missing" || blocker === "revision_relation_missing")
  if (needsRepair) return <PageFrame><PageState {...(canPreparePage ? { actionLabel: "Подготовить страницу" } : {})} icon={IconAlertTriangle} onAction={preparePage} title="Связь страницы с CRM требует обновления" tone="warning">{repairError ?? "Обновим точную связь с предложением, сохранив текст и адрес черновика. После этого проверьте адрес страницы и опубликуйте её."}</PageState></PageFrame>

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
    canonicalPrefix={direction === "house" ? "domiki" : direction === "campground" ? "kemping" : "dopy"}
  />
}
