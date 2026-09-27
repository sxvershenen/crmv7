import { IconExternalLink, IconShieldLock, IconUsers } from "@tabler/icons-react"
import type { Capabilities } from "@crm/contracts/capabilities"
import type { Role } from "@crm/contracts/auth"
import { Alert, AlertDescription, AlertTitle, Button, PageFrame, StatusBadge } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { crmAppBaseUrl } from "@admin/lib/crm-url"

const roleLabels: Record<Role, string> = {
  admin: "Администратор", manager: "Менеджер", lead_manager: "Менеджер заявок",
  manager_supervisor: "Старший менеджер", supervisor: "Руководитель", technical_admin: "Технический администратор", readonly: "Наблюдатель",
}

const groups: { title: string; permissions: { key: keyof Capabilities; label: string }[] }[] = [
  { title: "Страницы и публикация", permissions: [
    { key: "canViewContent", label: "Просмотр страниц" }, { key: "canEditContent", label: "Редактирование черновиков" },
    { key: "canReviewContent", label: "Проверка материалов" }, { key: "canPublishContent", label: "Публикация" },
  ] },
  { title: "Оформление и продвижение", permissions: [
    { key: "canManageMedia", label: "Медиа" }, { key: "canManageSeo", label: "SEO" },
    { key: "canManageRedirects", label: "Редиректы" }, { key: "canManageSiteSettings", label: "Настройки сайта" },
    { key: "canManageIntegrations", label: "Интеграции" }, { key: "canManageSiteCode", label: "Код сайта" },
  ] },
  { title: "Данные и доступ", permissions: [
    { key: "canViewAnalytics", label: "Сводная аналитика" }, { key: "canViewRawAnalytics", label: "Исходные события аналитики" },
    { key: "canViewAudit", label: "Журнал действий" }, { key: "canManageUsers", label: "Управление пользователями" },
  ] },
]

function crmTeamUrl() {
  return `${crmAppBaseUrl}/team?section=roles`
}

export function AccessPage() {
  const { user } = useAdminAuthSession()
  const roles = user.roles?.length ? user.roles : [user.role]
  return <PageFrame className="space-y-3"><PageHeading description="Права вашего сеанса из общего CRM-доступа. Здесь нет отдельного списка пользователей CMS." title="Пользователи и права" />
    <section className="rounded-xl border bg-background p-4"><div className="flex items-start gap-3"><IconShieldLock aria-hidden="true" className="size-5 shrink-0 text-primary" /><div className="min-w-0"><h2 className="text-sm font-medium">{user.displayName ?? user.name}</h2><p className="mt-1 text-xs text-muted-foreground">{roles.map((role) => roleLabels[role]).join(", ")}</p></div></div></section>
    <div className="grid gap-3 lg:grid-cols-2">{groups.map((group) => <section className="overflow-hidden rounded-xl border bg-background" key={group.title}><h2 className="border-b px-4 py-3 text-sm font-medium">{group.title}</h2><div className="divide-y">{group.permissions.map(({ key, label }) => <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2" key={key}><span className="text-xs">{label}</span><StatusBadge tone={user.capabilities[key] === true ? "success" : "neutral"}>{user.capabilities[key] === true ? "Назначено" : "Не назначено"}</StatusBadge></div>)}</div></section>)}</div>
    <Alert><IconUsers /><AlertTitle>Сотрудники и роли — в CRM</AlertTitle><AlertDescription><p>Там можно посмотреть состав команды. Изменение прав и приглашения пока не подключены к рабочему API; этот экран их не имитирует.</p><Button className="mt-3" onClick={() => window.location.assign(crmTeamUrl())} size="sm" variant="outline"><IconExternalLink />Открыть роли команды в CRM</Button></AlertDescription></Alert>
  </PageFrame>
}
