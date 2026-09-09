import type { ReactNode } from "react"
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconCheck, IconDeviceDesktop, IconDeviceMobile, IconDeviceTablet, IconExternalLink, IconGitBranch, IconInfoCircle, IconLink, IconLock, IconPhoto, IconRefresh, IconRoute, IconSparkles, IconX } from "@tabler/icons-react"
import { Link, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, DataTableShell, IconBox, Progress, StatusBadge, Tooltip, TooltipContent, TooltipTrigger, cn } from "@crm/ui"

import type { ContentStatus, InheritanceMode, QualityLevel, ReleaseGate, SectionConfig, SourceKind } from "@admin/entities/cms"

const statusMeta: Record<ContentStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  draft: { label: "Черновик", tone: "neutral" }, review: { label: "На проверке", tone: "warning" }, scheduled: { label: "Запланировано", tone: "info" }, published: { label: "Опубликовано", tone: "success" }, archived: { label: "Архив", tone: "neutral" }, failed: { label: "Ошибка", tone: "danger" },
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) { const meta = statusMeta[status]; return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge> }

const sourceMeta: Record<SourceKind, { label: string; icon: React.ElementType; className: string }> = {
  CMS: { label: "CMS", icon: IconSparkles, className: "border-primary/20 bg-primary/5 text-primary" },
  CRM: { label: "CRM · readonly", icon: IconLock, className: "border-info/25 bg-info-subtle text-info-foreground" },
  computed: { label: "Вычисляется", icon: IconGitBranch, className: "border-border bg-muted text-muted-foreground" },
  inherited: { label: "Наследуется", icon: IconLink, className: "border-warning/25 bg-warning-subtle text-warning-foreground" },
}
export function SourceMarker({ source }: { source: SourceKind }) { const meta = sourceMeta[source]; return <Badge className={cn("gap-1 font-normal", meta.className)} variant="outline"><meta.icon className="size-3" />{meta.label}</Badge> }

export function QualityIndicator({ compact = false, level }: { compact?: boolean; level: QualityLevel }) {
  const meta = level === "ok" ? { label: "Без ошибок", icon: IconCheck, tone: "success" as const } : level === "warning" ? { label: "Есть warning", icon: IconAlertTriangle, tone: "warning" as const } : { label: "Есть blocker", icon: IconX, tone: "danger" as const }
  return <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className={cn("size-2 rounded-full", level === "ok" ? "bg-success" : level === "warning" ? "bg-warning" : "bg-danger")} />{compact ? null : meta.label}</span>
}

export function PageHeading({ actions, description, eyebrow, title }: { actions?: ReactNode; description?: string; eyebrow?: string; title: string }) {
  return <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0">{eyebrow ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{eyebrow}</p> : null}<h2 className="text-base font-semibold leading-6">{title}</h2>{description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p> : null}</div>{actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}</header>
}

export function SegmentedControl<T extends string>({ ariaLabel, disabled = false, onChange, options, value }: { ariaLabel: string; disabled?: boolean; onChange: (value: T) => void; options: { label: string; value: T; icon?: React.ElementType }[]; value: T }) {
  return <div aria-label={ariaLabel} className="inline-flex rounded-md border bg-muted/50 p-0.5" role="group">{options.map((option) => <Button aria-pressed={option.value === value} className={cn("h-7 border-0 px-2 text-[11px]", option.value === value ? "bg-background shadow-xs hover:bg-background" : "bg-transparent text-muted-foreground shadow-none")} disabled={disabled} key={option.value} onClick={() => onChange(option.value)} size="sm" variant="outline">{option.icon ? <option.icon className="size-3.5" /> : null}{option.label}</Button>)}</div>
}

export function PreviewDeviceSwitch({ value, onChange }: { value: "desktop" | "tablet" | "mobile"; onChange: (value: "desktop" | "tablet" | "mobile") => void }) { return <SegmentedControl ariaLabel="Размер preview" onChange={onChange} options={[{ value: "desktop", label: "Desktop", icon: IconDeviceDesktop }, { value: "tablet", label: "Tablet", icon: IconDeviceTablet }, { value: "mobile", label: "Mobile", icon: IconDeviceMobile }]} value={value} /> }

export function InheritanceControl({ disabled = false, onChange, section }: { disabled?: boolean; onChange: (mode: InheritanceMode) => void; section: SectionConfig }) {
  return <div className="rounded-lg border bg-background p-3" data-testid={`inheritance-${section.id}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><IconBox icon={section.id === "hero" ? IconPhoto : section.id === "footer" ? IconRoute : IconSparkles} size="sm" variant={section.quality === "warning" ? "warning" : "info"} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-semibold">{section.label}</h3><QualityIndicator compact level={section.quality ?? "ok"} /></div><p className="mt-0.5 text-[11px] text-muted-foreground">{section.description}</p></div><SegmentedControl ariaLabel={`Поведение: ${section.label}`} disabled={disabled} onChange={onChange} options={[{ label: "Наследовать", value: "inherit" }, { label: "Настроить", value: "override" }, { label: "Скрыть", value: "disabled" }]} value={section.mode} /></div>
    <div className={cn("mt-3 border-t pt-3", section.mode === "disabled" && "text-muted-foreground")}>
      {section.mode === "disabled" ? <Alert className="border-warning/30 bg-warning-subtle"><IconAlertTriangle /><AlertTitle>Секция не попадёт на страницу</AlertTitle><AlertDescription>{section.id === "calculator" ? "Может снизить конверсию. Publish не заблокирован." : "Проверьте quality policy перед публикацией."}</AlertDescription></Alert> : <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-[10px] text-muted-foreground">Effective value</p><p className="truncate text-xs font-medium">{section.effectiveTitle}</p><Link className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline" to={section.sourceHref}>{section.source}<IconExternalLink className="size-3" /></Link></div>{section.mode === "override" ? <div className="flex gap-1"><Button onClick={() => window.alert(`${section.label}: local patch отличается от ${section.source}`)} size="xs" variant="outline">Показать diff</Button><Button onClick={() => onChange("inherit")} size="xs" variant="ghost">Сбросить</Button></div> : null}</div>}
    </div>
  </div>
}

export function ReleaseGateRow({ gate }: { gate: ReleaseGate }) {
  const meta = gate.state === "passed" ? { icon: IconCheck, className: "text-success", label: "Passed" } : gate.state === "warning" ? { icon: IconAlertTriangle, className: "text-warning-foreground", label: "Warning" } : gate.state === "running" ? { icon: IconRefresh, className: "animate-spin text-info", label: "Running" } : { icon: IconX, className: "text-danger", label: "Blocked" }
  return <div className="flex min-h-14 items-center gap-3 px-3 py-2"><meta.icon className={cn("size-4 shrink-0", meta.className)} /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{gate.label}</p><p className="truncate text-[10px] text-muted-foreground">{gate.detail}</p></div><span className="text-[10px] text-muted-foreground">{meta.label}</span></div>
}

export function StateToolbar() {
  const [params, setParams] = useSearchParams(); const state = params.get("state") ?? "default"
  return <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-2"><IconInfoCircle className="size-4 text-muted-foreground" /><span className="mr-auto text-[10px] text-muted-foreground">Prototype state</span><SegmentedControl ariaLabel="Состояние prototype" onChange={(next) => { const copy = new URLSearchParams(params); if (next === "default") copy.delete("state"); else copy.set("state", next); setParams(copy) }} options={[{ label: "Default", value: "default" }, { label: "Loading", value: "loading" }, { label: "Empty", value: "empty" }, { label: "Error", value: "error" }]} value={state} /> </div>
}

export function CmsTable({ children }: { children: ReactNode }) { return <DataTableShell className="hidden md:block" tableClassName="min-w-[820px] table-fixed">{children}</DataTableShell> }

export function SortButton({ active, children, direction = "asc", onClick }: { active?: boolean; children: ReactNode; direction?: "asc" | "desc"; onClick: () => void }) { return <Button className="h-7 px-1 text-[11px] font-medium" onClick={onClick} size="xs" variant="ghost">{children}{active ? direction === "asc" ? <IconArrowUp className="size-3" /> : <IconArrowDown className="size-3" /> : null}</Button> }

export function ProcessingCard({ label, progress, status }: { label: string; progress: number; status: string }) { return <Card><CardContent className="p-3"><div className="flex items-center gap-3"><IconBox icon={IconPhoto} size="sm" variant={status === "error" ? "danger" : "info"} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-xs font-medium">{label}</p><span className="text-[10px] text-muted-foreground">{progress}%</span></div><Progress className="mt-2 h-1.5" value={progress} /><p className="mt-1 text-[10px] text-muted-foreground">{status}</p></div></div></CardContent></Card> }

export function DisabledReason({ children, reason }: { children: ReactNode; reason: string }) { return <Tooltip><TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger><TooltipContent>{reason}</TooltipContent></Tooltip> }
