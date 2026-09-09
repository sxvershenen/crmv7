import { useEffect, useState } from "react";
import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconCloudDataConnection,
  IconDatabase,
  IconForms,
  IconPlugConnected,
  IconSettings,
  IconWorld,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";

import {
  Badge,
  Button,
  FormField,
  FormSelect,
  IconBox,
  Input,
  ListRow,
  ListSection,
  PageFrame,
  PageNav,
  PageState,
  Skeleton,
  Switch,
} from "@crm/ui";

import {
  workspaceRepository,
  type WorkspaceRepository,
} from "@app/data/workspace-repository";
import type {
  CrmSettings,
  IntegrationStatus,
  TeamMember,
} from "@app/entities/workspace";

const sections = ["organization", "operations", "site", "integrations"] as const;
type SettingsSection = (typeof sections)[number];
const navItems = [
  { value: "organization", label: "Организация", icon: IconBuilding },
  { value: "operations", label: "Рабочие правила", icon: IconAdjustments },
  { value: "site", label: "Сайт и CMS", icon: IconWorld },
  { value: "integrations", label: "Интеграции", icon: IconPlugConnected },
];

export function SettingsPage({ repository = workspaceRepository }: { repository?: WorkspaceRepository }) {
  const [params, setParams] = useSearchParams();
  const rawSection = params.get("section");
  const section: SettingsSection = sections.includes(rawSection as SettingsSection) ? rawSection as SettingsSection : "organization";
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestKey, setLoadRequestKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    void Promise.all([repository.getSettings(), repository.listTeam()])
      .then(([value, members]) => { if (active) { setSettings(value); setTeam(members); } })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить настройки.");
      });
    return () => { active = false; };
  }, [loadRequestKey, repository]);

  const change = (next: CrmSettings) => { setSettings(next); setDirty(true); setSaved(false); setSaveError(null); };
  const save = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      setSettings(await repository.saveSettings(settings));
      setDirty(false);
      setSaved(true);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить настройки.");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <PageFrame className="space-y-3" width="content">{loadError ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => { setLoadError(null); setSettings(null); setLoadRequestKey((value) => value + 1); }} title="Настройки не загрузились" tone="danger">{loadError}</PageState></div> : <div aria-label="Загрузка настроек" aria-live="polite" className="space-y-3" role="status"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-96 rounded-xl" /></div>}</PageFrame>;

  return <PageFrame className="space-y-3" width="content">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2"><p className="text-[11px] text-muted-foreground">Общие правила рабочего пространства. Личные предпочтения — в профиле.</p><Button disabled={saving} onClick={() => void save()} size="sm" variant={dirty ? "default" : "outline"}><IconCheck aria-hidden="true" />{saving ? "Сохраняем…" : saved ? "Сохранено" : dirty ? "Сохранить" : "Без изменений"}</Button></div>
    {saveError ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить сохранение" icon={IconAlertTriangle} onAction={() => void save()} title="Настройки не сохранены" tone="danger">{saveError}</PageState></div> : null}
    <PageNav ariaLabel="Разделы настроек CRM" items={navItems} onValueChange={(value) => setParams(value === "organization" ? {} : { section: value })} value={section} />
    {section === "organization" ? <OrganizationSettings settings={settings} update={change} /> : null}
    {section === "operations" ? <OperationsSettings settings={settings} update={change} /> : null}
    {section === "site" ? <SiteSettings settings={settings} team={team} update={change} /> : null}
    {section === "integrations" ? <IntegrationsSettings settings={settings} /> : null}
  </PageFrame>;
}

function OrganizationSettings({ settings, update }: SettingsProps) {
  const set = <K extends keyof CrmSettings["organization"]>(key: K, value: CrmSettings["organization"][K]) => update({ ...settings, organization: { ...settings.organization, [key]: value } });
  return <div className="overflow-hidden rounded-xl border bg-background"><ListSection count={6} icon={IconBuilding} title="Организация" tone="info"><ListRow className="grid gap-4 p-4 sm:grid-cols-2"><FormField htmlFor="settings-name" label="Название"><Input id="settings-name" onChange={(event) => set("name", event.target.value)} value={settings.organization.name} /></FormField><FormField htmlFor="settings-timezone" label="Часовой пояс"><FormSelect id="settings-timezone" label="Часовой пояс" onValueChange={(value) => set("timezone", value)} options={[{ value: "Europe/Moscow", label: "Москва (UTC+3)" }, { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" }]} value={settings.organization.timezone} /></FormField><FormField htmlFor="settings-phone" label="Общий телефон"><Input id="settings-phone" inputMode="tel" onChange={(event) => set("phone", event.target.value)} value={settings.organization.phone} /></FormField><FormField htmlFor="settings-email" label="Общий e-mail"><Input id="settings-email" onChange={(event) => set("email", event.target.value)} type="email" value={settings.organization.email} /></FormField><FormField htmlFor="settings-locale" label="Форматы"><FormSelect disabled id="settings-locale" label="Форматы" onValueChange={() => undefined} options={[{ value: "ru-RU", label: "Русский (Россия)" }]} value={settings.organization.locale} /></FormField><FormField htmlFor="settings-currency" label="Валюта"><FormSelect disabled id="settings-currency" label="Валюта" onValueChange={() => undefined} options={[{ value: "RUB", label: "Российский рубль (₽)" }]} value={settings.organization.currency} /></FormField></ListRow></ListSection></div>;
}

function OperationsSettings({ settings, update }: SettingsProps) {
  const set = <K extends keyof CrmSettings["operations"]>(key: K, value: CrmSettings["operations"][K]) => update({ ...settings, operations: { ...settings.operations, [key]: value } });
  return <div className="grid items-start gap-3 lg:grid-cols-2"><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconSettings} title="Операционные дефолты" tone="task"><ListRow className="grid gap-4 p-4"><FormField htmlFor="settings-booking-prefix" label="Префикс номера брони"><Input id="settings-booking-prefix" maxLength={4} onChange={(event) => set("bookingPrefix", event.target.value.toUpperCase())} value={settings.operations.bookingPrefix} /></FormField><FormField htmlFor="settings-lead-source" label="Источник новой заявки"><FormSelect id="settings-lead-source" label="Источник новой заявки" onValueChange={(value) => set("defaultLeadSource", value)} options={["Сайт", "Телефон", "Вручную"].map((value) => ({ value, label: value }))} value={settings.operations.defaultLeadSource} /></FormField><p className="text-[10px] leading-4 text-muted-foreground">Нумерация и статусные переходы применяются сервером.</p></ListRow></ListSection></div><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconAlertTriangle} title="Проверки и очереди" tone="warning"><ToggleRow checked={settings.operations.conflictWarnings} description="Предупреждать о пересечениях по ресурсу и времени" label="Конфликты броней" onChange={(value) => set("conflictWarnings", value)} /><ToggleRow checked={settings.operations.requireClientPhone} description="Телефон нужен для дедупликации и поиска связей" label="Требовать телефон клиента" onChange={(value) => set("requireClientPhone", value)} /><ToggleRow checked={settings.operations.autoAssignNewLeads} description="Пока распределение не настроено, новые заявки остаются в общей очереди" label="Автоназначение заявок" onChange={(value) => set("autoAssignNewLeads", value)} /></ListSection></div></div>;
}

function SiteSettings({ settings, team, update }: SettingsProps & { team: TeamMember[] }) {
  const set = <K extends keyof CrmSettings["site"]>(key: K, value: CrmSettings["site"][K]) => update({ ...settings, site: { ...settings.site, [key]: value } });
  return <div className="space-y-3"><section className="rounded-xl border bg-background p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><IconBox icon={IconCloudDataConnection} size="lg" variant="info" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[13px] font-semibold">Контракт CRM ↔ публичный сайт и CMS</h2><IntegrationBadge status={settings.site.connectionStatus} /></div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Сайт получает только опубликованные данные. Форма сайта создаёт заявку, но не подтверждённую бронь.</p></div></div><div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr]"><FlowStep icon={IconForms} label="Форма сайта" note="Даты, гости, UTM, consent" /><IconArrowRight aria-hidden="true" className="hidden self-center text-muted-foreground sm:block" /><FlowStep icon={IconDatabase} label="Заявка в CRM" note="Проверка и связывание" /><IconArrowRight aria-hidden="true" className="hidden self-center text-muted-foreground sm:block" /><FlowStep icon={IconCheck} label="Бронь" note="Только после решения менеджера" /></div></section><div className="grid items-start gap-3 lg:grid-cols-2"><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={4} icon={IconWorld} title="Публикация" tone="info"><ListRow className="p-4"><FormField htmlFor="site-url" label="Адрес сайта"><Input id="site-url" onChange={(event) => set("siteUrl", event.target.value)} type="url" value={settings.site.siteUrl} /></FormField></ListRow><ToggleRow checked={settings.site.publishResources} description="Названия, описания, фото и особенности из CMS" label="Опубликованные ресурсы" onChange={(value) => set("publishResources", value)} /><ToggleRow checked={settings.site.publishPrices} description="Только явно опубликованные public-цены" label="Публичные цены" onChange={(value) => set("publishPrices", value)} /></ListSection></div><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconForms} title="Входящие формы" tone="task"><ToggleRow checked={settings.site.intakeEnabled} description="Создавать Lead + contact + dates + guests + UTM + consent metadata" label="Принимать заявки с сайта" onChange={(value) => set("intakeEnabled", value)} /><ListRow className="grid gap-3 p-4"><FormField htmlFor="site-source" label="Источник"><FormSelect id="site-source" label="Источник заявок с сайта" onValueChange={(value) => set("defaultSource", value)} options={[{ value: "Сайт", label: "Сайт" }, { value: "Лендинг", label: "Лендинг" }]} value={settings.site.defaultSource} /></FormField><FormField htmlFor="site-assignee" label="Очередь / ответственный"><FormSelect id="site-assignee" label="Ответственный за заявки с сайта" onValueChange={(value) => set("defaultAssigneeId", value)} options={[{ value: "queue", label: "Общая очередь" }, ...team.filter((item) => item.status === "active").map((item) => ({ value: item.id, label: item.name }))]} value={settings.site.defaultAssigneeId} /></FormField><p className="text-[10px] leading-4 text-muted-foreground">Автораспределение включится после настройки расписания и ролей.</p></ListRow></ListSection></div></div></div>;
}

function IntegrationsSettings({ settings }: { settings: CrmSettings }) { return <div className="overflow-hidden rounded-xl border bg-background"><ListSection count={settings.integrations.length} icon={IconPlugConnected} title="Подключения" tone="info">{settings.integrations.map((integration) => <ListRow className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center" key={integration.id}><IconBox icon={integration.id === "site" ? IconWorld : integration.id === "cms" ? IconDatabase : IconPlugConnected} size="sm" variant={integration.status === "connected" ? "success" : integration.status === "attention" ? "warning" : "neutral"} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs">{integration.name}</p><IntegrationBadge status={integration.status} /></div><p className="mt-1 text-[10px] text-muted-foreground">{integration.description}</p></div><div className="sm:text-right"><p className="text-[10px] text-muted-foreground">{integration.lastSyncLabel}</p><Button className="mt-1" disabled size="xs" title="Подключение пока запланировано" variant="outline">Настроить</Button></div></ListRow>)}</ListSection></div>; }

type SettingsProps = { settings: CrmSettings; update: (settings: CrmSettings) => void };
function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (value: boolean) => void }) { return <ListRow className="flex min-h-16 items-center gap-4 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-xs">{label}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /></ListRow>; }
function FlowStep({ icon, label, note }: { icon: React.ElementType; label: string; note: string }) { return <div className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/45 p-3"><IconBox icon={icon} size="sm" variant="neutral" /><div className="min-w-0"><p className="text-xs">{label}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{note}</p></div></div>; }
function IntegrationBadge({ status }: { status: IntegrationStatus }) { return <Badge variant={status === "connected" ? "default" : status === "attention" ? "secondary" : "outline"}>{status === "connected" ? "Подключено" : status === "attention" ? "Нужно внимание" : "Запланировано"}</Badge>; }
