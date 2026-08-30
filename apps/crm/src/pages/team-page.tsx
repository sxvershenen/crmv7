import { useEffect, useMemo, useState } from "react";
import {
  IconActivity,
  IconAlertTriangle,
  IconClock,
  IconDotsVertical,
  IconInfoCircle,
  IconMailForward,
  IconPlus,
  IconSearch,
  IconShield,
  IconUserCheck,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useSearchParams } from "react-router-dom";

import {
  Avatar,
  AvatarFallback,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  DataTableShell,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FilterSelect,
  FormField,
  FormSelect,
  Input,
  ListRow,
  ListSection,
  PageFrame,
  PageNav,
  PageState,
  SettingsBar,
  Skeleton,
  SummaryMetric,
  SummaryMetricStrip,
} from "@crm/ui";

import {
  workspaceRepository,
  type WorkspaceRepository,
} from "@app/data/workspace-repository";
import type { TeamMember, TeamMemberStatus } from "@app/entities/workspace";

const sections = ["members", "roles", "workload"] as const;
type TeamSection = (typeof sections)[number];
const navItems = [
  { value: "members", label: "Сотрудники", icon: IconUsersGroup },
  { value: "roles", label: "Роли и доступы", icon: IconShield },
  { value: "workload", label: "Нагрузка", icon: IconActivity },
];
const statusLabels: Record<TeamMemberStatus, string> = {
  active: "Активен",
  archived: "Архив",
  away: "Нет на месте",
  invited: "Приглашён",
};

export function TeamPage({ repository = workspaceRepository }: { repository?: WorkspaceRepository }) {
  const [params, setParams] = useSearchParams();
  const rawSection = params.get("section");
  const section: TeamSection = sections.includes(rawSection as TeamSection) ? rawSection as TeamSection : "members";
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [query, setQuery] = useState(() => params.get("search") ?? "");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("current");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Менеджер по броням");
  const [inviteSent, setInviteSent] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequestKey, setLoadRequestKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    void repository
      .listTeam()
      .then((value) => active && setMembers(value))
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Не удалось загрузить команду.");
      });
    return () => { active = false; };
  }, [loadRequestKey, repository]);

  const roles = useMemo(() => [...new Set(members?.map((member) => member.role) ?? [])], [members]);
  const filtered = useMemo(() => (members ?? []).filter((member) => {
    const needle = query.toLocaleLowerCase("ru-RU");
    const matchesQuery = !needle || `${member.name} ${member.email} ${member.phone}`.toLocaleLowerCase("ru-RU").includes(needle);
    const matchesRole = role === "all" || member.role === role;
    const matchesStatus = status === "all" || (status === "current" ? member.status !== "archived" : member.status === status);
    return matchesQuery && matchesRole && matchesStatus;
  }), [members, query, role, status]);

  if (!members) return <PageFrame className="space-y-3" width="wide">{loadError ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => { setLoadError(null); setLoadRequestKey((value) => value + 1); }} title="Команда не загрузилась" tone="danger">{loadError}</PageState></div> : <div aria-label="Загрузка команды" aria-live="polite" className="space-y-3" role="status"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-80 rounded-xl" /></div>}</PageFrame>;

  return <PageFrame className="space-y-3" width="wide">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
      <p className="text-[11px] text-muted-foreground">Люди, их роли и текущая операционная нагрузка.</p>
      <Button onClick={() => { setInviteOpen((value) => !value); setInviteSent(false); }} size="sm"><IconPlus aria-hidden="true" />Пригласить</Button>
    </div>
    <PageNav ariaLabel="Разделы команды" items={navItems} onValueChange={(value) => setParams(value === "members" ? {} : { section: value })} value={section} />
    {inviteOpen ? <InvitePanel email={inviteEmail} onClose={() => setInviteOpen(false)} onEmailChange={setInviteEmail} onRoleChange={setInviteRole} onSend={() => setInviteSent(true)} role={inviteRole} sent={inviteSent} /> : null}
    {section === "members" ? <><SummaryMetricStrip ariaLabel="Сводка команды"><SummaryMetric icon={IconUsersGroup} label="Всего" tone="info" value={members.length}>{members.filter((item) => item.status !== "archived").length} текущих</SummaryMetric><SummaryMetric icon={IconUserCheck} label="Активны сейчас" tone="success" value={members.filter((item) => item.status === "active").length}>Видны в рабочих очередях</SummaryMetric><SummaryMetric icon={IconClock} label="Открытая нагрузка" tone="warning" value={members.reduce((sum, item) => sum + item.openItems, 0)}>Заявки, брони и задачи</SummaryMetric></SummaryMetricStrip><TeamFilters query={query} role={role} roles={roles} setQuery={setQuery} setRole={setRole} setStatus={setStatus} status={status} /><MembersView members={filtered} /></> : null}
    {section === "roles" ? <RolesView members={members} /> : null}
    {section === "workload" ? <WorkloadView members={members.filter((item) => item.status !== "archived")} /> : null}
  </PageFrame>;
}

function TeamFilters({ query, role, roles, setQuery, setRole, setStatus, status }: { query: string; role: string; roles: string[]; setQuery: (value: string) => void; setRole: (value: string) => void; setStatus: (value: string) => void; status: string }) {
  return <SettingsBar filters={<><FilterSelect label="Статус" onValueChange={setStatus} options={[{ value: "current", label: "Текущие" }, { value: "active", label: "Активные" }, { value: "away", label: "Нет на месте" }, { value: "invited", label: "Приглашённые" }, { value: "all", label: "Все" }]} value={status} /><FilterSelect label="Роль" onValueChange={setRole} options={[{ value: "all", label: "Все роли" }, ...roles.map((value) => ({ value, label: value }))]} value={role} /></>} primary={<label className="flex h-8 min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 md:w-72"><IconSearch aria-hidden="true" className="size-4 text-muted-foreground" /><Input aria-label="Поиск сотрудников" className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" onChange={(event) => setQuery(event.target.value)} placeholder="Имя, e-mail или телефон" value={query} /></label>} />;
}

function MembersView({ members }: { members: TeamMember[] }) {
  return <><div className="grid gap-2 md:hidden">{members.map((member) => <MemberCard key={member.id} member={member} />)}</div><DataTableShell className="hidden md:block" tableClassName="min-w-[820px]"><thead className="border-b bg-muted/45"><tr><th className="px-3 py-2 text-left text-[11px] font-medium">Сотрудник</th><th className="px-3 py-2 text-left text-[11px] font-medium">Роль</th><th className="px-3 py-2 text-left text-[11px] font-medium">Статус</th><th className="px-3 py-2 text-left text-[11px] font-medium">Нагрузка</th><th className="px-3 py-2 text-left text-[11px] font-medium">Активность</th><th className="w-12"><span className="sr-only">Действия</span></th></tr></thead><tbody className="divide-y">{members.map((member) => <tr className="hover:bg-muted/35" key={member.id}><td className="px-3 py-2.5"><MemberIdentity member={member} /></td><td className="px-3 py-2.5 text-xs">{member.role}</td><td className="px-3 py-2.5"><MemberStatus status={member.status} /></td><td className="px-3 py-2.5 text-xs tabular-nums">{member.openItems} открыто</td><td className="px-3 py-2.5 text-xs text-muted-foreground">{member.lastActiveLabel}</td><td className="px-2"><MemberMenu member={member} /></td></tr>)}</tbody></DataTableShell>{members.length === 0 ? <div className="rounded-xl border bg-background p-8 text-center text-xs text-muted-foreground">Сотрудники не найдены</div> : null}</>;
}

function MemberIdentity({ member }: { member: TeamMember }) { return <div className="flex min-w-0 items-center gap-2.5"><Avatar className="size-8"><AvatarFallback className={`${member.colorClass} text-[10px]`}>{member.initials}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-xs">{member.name}</p><p className="truncate text-[10px] text-muted-foreground">{member.email}</p></div></div>; }
function MemberStatus({ status }: { status: TeamMemberStatus }) { return <Badge variant={status === "active" ? "default" : status === "invited" ? "outline" : "secondary"}>{statusLabels[status]}</Badge>; }
function MemberMenu({ member }: { member: TeamMember }) { return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Действия: ${member.name}`} size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled>Профиль после auth/RBAC</DropdownMenuItem><DropdownMenuItem disabled>Изменить роль после RBAC</DropdownMenuItem>{member.status === "invited" ? <DropdownMenuItem disabled><IconMailForward aria-hidden="true" />Повторить после e-mail API</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>; }
function MemberCard({ member }: { member: TeamMember }) { return <article className="rounded-xl border bg-background p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><MemberIdentity member={member} /></div><MemberMenu member={member} /></div><div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"><MemberStatus status={member.status} /><span className="text-[10px] text-muted-foreground">{member.role}</span><span className="ml-auto text-[10px] tabular-nums text-muted-foreground">{member.openItems} открыто</span></div></article>; }

function RolesView({ members }: { members: TeamMember[] }) { const roles = [...new Set(members.map((item) => item.role))]; return <div className="overflow-hidden rounded-xl border bg-background"><ListSection count={roles.length} icon={IconShield} title="Роли команды" tone="info">{roles.map((role) => <ListRow className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center" key={role}><div><p className="text-xs">{role}</p><p className="mt-1 text-[10px] text-muted-foreground">Доступ определит backend RBAC; здесь показана целевая структура.</p></div><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{members.filter((item) => item.role === role).length} чел.</span><Button disabled size="xs" variant="outline">Настроить права</Button></div></ListRow>)}</ListSection></div>; }
function WorkloadView({ members }: { members: TeamMember[] }) {
  const max = Math.max(...members.map((item) => item.openItems), 1);
  return <div className="space-y-3"><Alert className="bg-background"><IconInfoCircle aria-hidden="true" /><AlertTitle className="text-xs">Как считается нагрузка</AlertTitle><AlertDescription className="text-[10px] leading-4">Считаем открытые заявки, брони и задачи. Полоса показывает долю от максимума в текущем списке, а не процент занятости. График, роль и отпуск не влияют на расчёт до backend-этапа.</AlertDescription></Alert><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={members.length} icon={IconActivity} title="Текущая нагрузка" tone="warning">{[...members].sort((a, b) => b.openItems - a.openItems).map((member) => <ListRow className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,240px)_minmax(160px,1fr)_150px_80px] sm:items-center" key={member.id}><MemberIdentity member={member} /><div><div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${member.name}: ${member.openItems} открытых`} role="img"><div className="h-full rounded-full bg-foreground/55" style={{ width: `${member.openItems / max * 100}%` }} /></div><p className="mt-1 text-[10px] text-muted-foreground">Относительно максимума: {Math.round(member.openItems / max * 100)}%</p></div><div className="text-[10px] leading-4 text-muted-foreground"><p>График не настроен</p><p>{member.status === "away" ? "Нет на месте · причина не указана" : "Данные об отпуске не подключены"}</p></div><span className="text-right text-xs tabular-nums">{member.openItems} открыто</span></ListRow>)}</ListSection></div></div>;
}

function InvitePanel({ email, onClose, onEmailChange, onRoleChange, onSend, role, sent }: { email: string; onClose: () => void; onEmailChange: (value: string) => void; onRoleChange: (value: string) => void; onSend: () => void; role: string; sent: boolean }) { return <section className="rounded-xl border bg-background p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[13px] font-semibold">Новый сотрудник</p><p className="mt-1 text-[10px] text-muted-foreground">Приглашение станет рабочим после подключения auth и e-mail.</p></div><Button onClick={onClose} size="xs" variant="ghost">Закрыть</Button></div><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto]"><FormField htmlFor="invite-email" label="E-mail"><Input id="invite-email" onChange={(event) => onEmailChange(event.target.value)} placeholder="name@example.ru" type="email" value={email} /></FormField><FormField htmlFor="invite-role" label="Роль"><FormSelect id="invite-role" label="Роль" onValueChange={onRoleChange} options={["Менеджер по броням", "Администратор", "Координатор программ"].map((value) => ({ value, label: value }))} value={role} /></FormField><Button disabled={!email.includes("@") || sent} onClick={onSend} size="sm"><IconMailForward aria-hidden="true" />{sent ? "Отправлено" : "Отправить"}</Button></div></section>; }
