import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconBell,
  IconCheck,
  IconDeviceDesktop,
  IconLanguage,
  IconLock,
  IconMail,
  IconShieldCheck,
  IconUser,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";

import {
  Avatar,
  AvatarFallback,
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
import type { WorkspaceProfile } from "@app/entities/workspace";

const tabs = ["account", "notifications", "security"] as const;
type ProfileTab = (typeof tabs)[number];
const tabItems = [
  { value: "account", label: "Личные данные", icon: IconUser },
  { value: "notifications", label: "Уведомления", icon: IconBell },
  { value: "security", label: "Безопасность", icon: IconShieldCheck },
];

export function ProfilePage({
  repository = workspaceRepository,
}: {
  repository?: WorkspaceRepository;
}) {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: ProfileTab = tabs.includes(rawTab as ProfileTab)
    ? (rawTab as ProfileTab)
    : "account";
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestKey, setLoadRequestKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    void repository
      .getProfile()
      .then((value) => active && setProfile(value))
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить профиль.");
      });
    return () => {
      active = false;
    };
  }, [loadRequestKey, repository]);

  const update = <K extends keyof WorkspaceProfile>(
    key: K,
    value: WorkspaceProfile[K],
  ) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
    setSaved(false);
    setSaveError(null);
  };
  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      setProfile(await repository.saveProfile(profile));
      setDirty(false);
      setSaved(true);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить профиль.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <PageFrame className="space-y-3" width="content">
        {loadError ? (
          <div className="rounded-xl border bg-surface-raised">
            <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => setLoadRequestKey((value) => value + 1)} title="Профиль не загрузился" tone="danger">
              {loadError}
            </PageState>
          </div>
        ) : (
          <div aria-label="Загрузка профиля" aria-live="polite" className="space-y-3" role="status">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        )}
      </PageFrame>
    );
  }

  return (
    <PageFrame className="space-y-3" width="content">
      <section className="flex flex-col gap-4 rounded-xl border bg-background p-4 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarFallback className="bg-sky-100 text-base text-sky-700">
            {profile.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{profile.name}</h2>
            <Badge variant="secondary">В системе</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{profile.role}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Личные настройки влияют только на вашу работу в CRM.
          </p>
        </div>
        <Button disabled={saving} onClick={() => void save()} size="sm" variant={dirty ? "default" : "outline"}>
          <IconCheck aria-hidden="true" />
          {saving ? "Сохраняем…" : saved ? "Сохранено" : dirty ? "Сохранить" : "Без изменений"}
        </Button>
      </section>

      {saveError ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Повторить сохранение" icon={IconAlertTriangle} onAction={() => void save()} title="Профиль не сохранён" tone="danger">
            {saveError}
          </PageState>
        </div>
      ) : null}

      <PageNav
        ariaLabel="Разделы профиля"
        items={tabItems}
        onValueChange={(value) => setParams(value === "account" ? {} : { tab: value })}
        value={tab}
      />

      {tab === "account" ? <AccountTab profile={profile} update={update} /> : null}
      {tab === "notifications" ? (
        <NotificationsTab profile={profile} update={update} />
      ) : null}
      {tab === "security" ? <SecurityTab /> : null}
    </PageFrame>
  );
}

function AccountTab({
  profile,
  update,
}: {
  profile: WorkspaceProfile;
  update: <K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) => void;
}) {
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-xl border bg-background">
        <ListSection count={4} icon={IconUser} title="Контакты" tone="info">
          <ListRow className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField htmlFor="profile-name" label="Имя и фамилия">
              <Input id="profile-name" onChange={(event) => update("name", event.target.value)} value={profile.name} />
            </FormField>
            <FormField htmlFor="profile-role" label="Роль">
              <Input disabled id="profile-role" value={profile.role} />
            </FormField>
            <FormField htmlFor="profile-email" label="E-mail">
              <Input id="profile-email" onChange={(event) => update("email", event.target.value)} type="email" value={profile.email} />
            </FormField>
            <FormField htmlFor="profile-phone" label="Телефон">
              <Input id="profile-phone" inputMode="tel" onChange={(event) => update("phone", event.target.value)} value={profile.phone} />
            </FormField>
          </ListRow>
        </ListSection>
      </div>
      <div className="overflow-hidden rounded-xl border bg-background">
        <ListSection count={2} icon={IconLanguage} title="Форматы" tone="neutral">
          <ListRow className="grid gap-4 p-4">
            <FormField htmlFor="profile-language" label="Язык">
              <FormSelect disabled id="profile-language" label="Язык" onValueChange={() => undefined} options={[{ value: "ru", label: "Русский" }]} value={profile.language} />
            </FormField>
            <FormField htmlFor="profile-timezone" label="Часовой пояс">
              <FormSelect id="profile-timezone" label="Часовой пояс" onValueChange={(value) => update("timezone", value)} options={[{ value: "Europe/Moscow", label: "Москва (UTC+3)" }, { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" }]} value={profile.timezone} />
            </FormField>
          </ListRow>
        </ListSection>
      </div>
    </div>
  );
}

function NotificationsTab({ profile, update }: { profile: WorkspaceProfile; update: <K extends keyof WorkspaceProfile>(key: K, value: WorkspaceProfile[K]) => void }) {
  return <div className="grid items-start gap-3 lg:grid-cols-2"><SettingsList icon={IconBell} title="Рабочие события"><ToggleRow checked={profile.notifyNewLeads} description="Когда заявка попала в очередь или назначена вам" label="Новые заявки" onChange={(value) => update("notifyNewLeads", value)} /><ToggleRow checked={profile.notifyConflicts} description="Пересечения ресурсов, оплат и изменений" label="Конфликты броней" onChange={(value) => update("notifyConflicts", value)} /><ToggleRow checked={profile.notifyOverdueTasks} description="Просроченные и заблокированные задачи" label="Проблемы задач" onChange={(value) => update("notifyOverdueTasks", value)} /></SettingsList><SettingsList icon={IconMail} title="Каналы"><ToggleRow checked={profile.browserNotifications} description="Пока CRM открыта в браузере" label="В CRM и браузере" onChange={(value) => update("browserNotifications", value)} /><ToggleRow checked={profile.telegramNotifications} description="Критичные события и личные назначения" label="Telegram" onChange={(value) => update("telegramNotifications", value)} /><ToggleRow checked={profile.emailNotifications} description="Ежедневная сводка и важные оповещения" label="E-mail" onChange={(value) => update("emailNotifications", value)} /></SettingsList></div>;
}

function SecurityTab() {
  return <div className="grid items-start gap-3 lg:grid-cols-2"><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={2} icon={IconLock} title="Вход и доступ" tone="success"><ListRow className="flex items-center gap-3 p-4"><IconBox icon={IconShieldCheck} size="sm" variant="success" /><div className="min-w-0 flex-1"><p className="text-xs">Внутренняя авторизация активна</p><p className="mt-1 text-[10px] text-muted-foreground">Пароли и 2FA управляются отдельным security-процессом.</p></div></ListRow><ListRow className="p-4"><Button disabled size="sm" variant="outline">Настроить 2FA</Button></ListRow></ListSection></div><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={1} icon={IconDeviceDesktop} title="Сеансы" tone="neutral"><ListRow className="flex items-center gap-3 p-4"><IconBox icon={IconDeviceDesktop} size="sm" variant="neutral" /><div className="min-w-0 flex-1"><p className="text-xs">Текущее устройство</p><p className="mt-1 text-[10px] text-muted-foreground">macOS · Москва · активно сейчас</p></div><Badge variant="secondary">Текущий</Badge></ListRow></ListSection></div></div>;
}

function SettingsList({ children, icon, title }: { children: React.ReactNode; icon: React.ElementType; title: string }) {
  const count = Array.isArray(children) ? children.length : 1;
  return <div className="overflow-hidden rounded-xl border bg-background"><ListSection count={count} icon={icon} title={title} tone="info">{children}</ListSection></div>;
}

function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (value: boolean) => void }) {
  return <ListRow className="flex min-h-16 items-center gap-4 px-4 py-3"><div className="min-w-0 flex-1"><p className="text-xs">{label}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /></ListRow>;
}
