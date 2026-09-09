import { useCallback, useMemo, useState } from "react"
import { IconAlertTriangle, IconArrowMoveRight, IconChevronDown, IconChevronRight, IconCopy, IconEye, IconFilePlus, IconFolder, IconLayoutList, IconSearch, IconSitemap } from "@tabler/icons-react"
import { Link, useSearchParams } from "react-router-dom"

import { Button, IconBox, Input, LoadingRows, PageFrame, PageState, cn } from "@crm/ui"

import { ContentStatusBadge, PageHeading, QualityIndicator, SegmentedControl, SourceMarker, StateToolbar } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { ContentNode } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"

export function ContentTreePage() {
  const [params, setParams] = useSearchParams(); const [view, setView] = useState<"tree" | "table">("tree"); const selected = params.get("selected") ?? "home"; const query = params.get("q") ?? ""
  // Load the complete topology: a filtered API response cannot retain ancestors for search.
  const loader = useCallback(() => cmsRepository.getNodes({}), []); const state = useRepository(loader)
  const accessLoader = useCallback(() => cmsRepository.getAccess(), []); const access = useRepository(accessLoader)
  const tree = useMemo(() => buildContentTree(state.data ?? [], query), [query, state.data])
  const nodes = tree.visibleNodes
  const current = (state.data ?? []).find((node) => node.id === selected)
  const collapsed = useMemo(() => new Set((params.get("collapsed") ?? "").split(",").filter(Boolean)), [params])
  const toggleCollapsed = (id: string) => {
    const next = new URLSearchParams(params)
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id)
    if (collapsed.size) next.set("collapsed", [...collapsed].join(",")); else next.delete("collapsed")
    setParams(next, { replace: true })
  }
  const cannotCreate = access.loading || access.error !== undefined || access.data?.canEditContent !== true
  return <PageFrame width="full"><PageHeading actions={<Button disabled={cannotCreate} onClick={() => window.location.assign("/content/pages/new")} size="sm" title={access.loading ? "Проверяем права…" : access.error ? "Не удалось определить права сессии" : cannotCreate ? "Нет canEditContent" : undefined}><IconFilePlus />Новая страница</Button>} description="Route topology, ownership, quality и effective dependencies. Перенос URL сначала покажет blast radius и redirect proposal." title="Структура сайта" /><StateToolbar /><div className="mt-3 flex flex-col gap-2 rounded-xl border bg-background p-2 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><IconSearch className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Поиск по структуре" className="pl-8" onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("q", event.target.value); else next.delete("q"); setParams(next, { replace: true }) }} placeholder="Title, slug, route, CRM entity, filename…" value={query} /></div><SegmentedControl ariaLabel="Вид структуры" onChange={setView} options={[{ label: "Дерево", value: "tree", icon: IconSitemap }, { label: "Таблица", value: "table", icon: IconLayoutList }]} value={view} /></div>
    {state.loading ? <div className="mt-3 rounded-xl border bg-background"><LoadingRows count={6} /></div> : state.error ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить дерево" /> : nodes.length === 0 ? <PageState icon={IconSearch} title="Ничего не найдено">Измените поиск или сбросьте фильтры.</PageState> : view === "tree" ? <div className="mt-3 grid min-h-[620px] overflow-hidden rounded-xl border bg-background lg:grid-cols-[minmax(300px,38%)_1fr]"><div className="border-b lg:border-b-0 lg:border-r"><div className="border-b px-4 py-3"><h3 className="text-[13px] font-semibold">Routes</h3><p className="text-[10px] text-muted-foreground">{nodes.length} nodes · drag available after API authority</p></div><div className="max-h-[360px] overflow-auto p-2 lg:max-h-[570px]"><TreeRows collapsed={collapsed} entries={tree.roots} forceExpanded={Boolean(query)} onSelect={(node) => { const next = new URLSearchParams(params); next.set("selected", node.id); setParams(next) }} onToggle={toggleCollapsed} selected={selected} /></div></div><NodeInspector {...(current ?? nodes[0] ? { node: current ?? nodes[0]! } : {})} /></div> : <TreeTable nodes={nodes} />}
  </PageFrame>
}

type TreeEntry = { node: ContentNode; depth: number; children: TreeEntry[]; relation?: "orphan" | "cycle" }

// eslint-disable-next-line react-refresh/only-export-components -- pure topology helper is covered without mutating repository fixtures.
export function buildContentTree(nodes: ContentNode[], query: string) {
  const unique = new Map<string, ContentNode>()
  for (const node of nodes) if (!unique.has(node.id)) unique.set(node.id, node)
  const all = [...unique.values()].sort(compareContentNodes)
  const cyclic = new Set<string>()
  for (const node of all) {
    const path = new Map<string, number>(); let cursor: ContentNode | undefined = node
    while (cursor) {
      const seenAt = path.get(cursor.id)
      if (seenAt !== undefined) { for (const id of [...path.keys()].slice(seenAt)) cyclic.add(id); break }
      path.set(cursor.id, path.size); cursor = cursor.parentId ? unique.get(cursor.parentId) : undefined
    }
  }
  const children = new Map<string, ContentNode[]>()
  const roots: TreeEntry[] = []
  const relation = (node: ContentNode): TreeEntry["relation"] | undefined => {
    if (cyclic.has(node.id)) return "cycle"
    return node.parentId && !unique.has(node.parentId) ? "orphan" : undefined
  }
  for (const node of all) {
    if (node.parentId && unique.has(node.parentId) && !cyclic.has(node.id)) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  }
  const search = query.trim().toLocaleLowerCase("ru-RU")
  const included = new Set<string>()
  if (search) for (const node of all) if (`${node.title} ${node.path}`.toLocaleLowerCase("ru-RU").includes(search)) {
    let cursor: ContentNode | undefined = node; const ancestry = new Set<string>()
    while (cursor && !ancestry.has(cursor.id)) { included.add(cursor.id); ancestry.add(cursor.id); cursor = cursor.parentId ? unique.get(cursor.parentId) : undefined }
  }
  const makeEntry = (node: ContentNode, depth: number, ancestry = new Set<string>()): TreeEntry | null => {
    if (search && !included.has(node.id)) return null
    if (ancestry.has(node.id)) return null
    const nextAncestry = new Set(ancestry).add(node.id)
    const nodeRelation = relation(node)
    return { node, depth, ...(nodeRelation ? { relation: nodeRelation } : {}), children: (children.get(node.id) ?? []).flatMap((child) => { const entry = makeEntry(child, depth + 1, nextAncestry); return entry ? [entry] : [] }) }
  }
  for (const node of all) if (!node.parentId || !unique.has(node.parentId) || cyclic.has(node.id)) { const entry = makeEntry(node, 0); if (entry) roots.push(entry) }
  return { roots, visibleNodes: roots.flatMap(flattenEntries) }
}

function compareContentNodes(left: ContentNode, right: ContentNode) {
  return left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, "ru-RU") || left.path.localeCompare(right.path, "ru-RU") || left.id.localeCompare(right.id)
}

function flattenEntries(entry: TreeEntry): ContentNode[] { return [entry.node, ...entry.children.flatMap(flattenEntries)] }

function TreeRows({ collapsed, entries, forceExpanded, onSelect, onToggle, selected }: { collapsed: Set<string>; entries: TreeEntry[]; forceExpanded: boolean; onSelect: (node: ContentNode) => void; onToggle: (id: string) => void; selected: string }) {
  return entries.map((entry) => <TreeRow collapsed={collapsed} entry={entry} forceExpanded={forceExpanded} key={entry.node.id} onSelect={onSelect} onToggle={onToggle} selectedId={selected} />)
}

function TreeRow({ collapsed, entry, forceExpanded, onSelect, onToggle, selectedId }: { collapsed: Set<string>; entry: TreeEntry; forceExpanded: boolean; onSelect: (node: ContentNode) => void; onToggle: (id: string) => void; selectedId: string }) {
  const { node } = entry; const hasChildren = entry.children.length > 0; const expanded = forceExpanded || !collapsed.has(node.id); const selected = selectedId === node.id
  return <div className="min-w-0"><div className="mb-0.5 flex min-w-0" style={{ paddingLeft: 8 + entry.depth * 18 }}><span className="flex size-8 shrink-0 items-center justify-center">{hasChildren ? <Button aria-expanded={expanded} aria-label={`${expanded ? "Свернуть" : "Развернуть"} ${node.title}`} className="size-7" onClick={() => onToggle(node.id)} size="icon-xs" variant="ghost">{expanded ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}</Button> : <IconChevronRight className="size-4 text-muted-foreground/50" />}</span><Button aria-selected={selected} className={cn("h-auto min-h-11 min-w-0 flex-1 justify-start px-2 py-1.5 text-left", selected && "bg-accent")} onClick={() => onSelect(node)} variant="ghost"><IconBox icon={node.type === "category" ? IconFolder : IconSitemap} size="sm" variant={node.quality === "blocker" ? "danger" : node.quality === "warning" ? "warning" : "neutral"} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{node.title}</span><span className="block truncate text-[10px] text-muted-foreground">{node.path}</span>{entry.relation ? <span className="block text-[10px] text-warning">{entry.relation === "orphan" ? "Родитель не найден: показано в корне" : "Цикл parentId: показано безопасно"}</span> : null}</span><QualityIndicator compact level={node.quality} /></Button></div>{hasChildren && expanded ? <TreeRows collapsed={collapsed} entries={entry.children} forceExpanded={forceExpanded} onSelect={onSelect} onToggle={onToggle} selected={selectedId} /> : null}</div>
}

function NodeInspector({ node }: { node?: ContentNode }) { if (!node) return null; const href = node.type === "home" ? "/content/home" : node.type === "category" ? `/content/categories/${node.id}` : node.type === "profile" ? `/content/public-profiles/resource/${node.id}` : node.type === "article" ? `/content/articles/${node.id}` : `/content/pages/${node.id}`; return <section className="min-w-0 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><IconBox icon={IconSitemap} variant={node.type === "category" ? "program" : "info"} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{node.title}</h3><ContentStatusBadge status={node.status} /><QualityIndicator level={node.quality} /></div><p className="mt-1 font-mono text-xs text-muted-foreground">{node.path}</p></div><div className="flex gap-1"><Button disabled size="sm" title="Preview API ещё не реализован" variant="outline"><IconEye />Preview</Button><Button onClick={() => window.location.assign(href)} size="sm">Открыть</Button></div></div><div className="mt-5 grid gap-x-8 gap-y-3 border-y py-4 sm:grid-cols-2"><Info label="Тип страницы" value={node.pageKind} /><Info label="Владелец" value={node.owner} /><Info label="Обновлено" value={node.updatedLabel} /><Info label="Источник" value={<span className="inline-flex items-center gap-1"><SourceMarker source={node.source ?? "CMS"} />{node.sourceKind ? <span className="font-mono text-[10px] text-muted-foreground">{node.sourceKind}</span> : null}</span>} /><Info label="Входящие ссылки" value={node.inboundLinks === null ? "Нет в content API" : String(node.inboundLinks)} /><Info label="Медиа в revision" value={node.mediaCount === null ? "Нет в content API" : String(node.mediaCount)} /></div><h4 className="mt-5 text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">Действия с маршрутом</h4><div className="mt-2 grid gap-2 sm:grid-cols-3"><Action icon={IconFilePlus} label="Создать child" parentNodeId={node.id} /><Action icon={IconCopy} label="Дублировать" /><Action icon={IconArrowMoveRight} label="Перенести / URL" /></div><div className="mt-5 rounded-lg border border-warning/25 bg-warning-subtle p-3"><p className="text-xs font-medium">Изменение path сохраняется в новую draft revision</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Redirect proposal и release blast radius появятся после подключения publication API.</p></div></section> }
function Info({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-muted-foreground">{label}</span><span className="text-xs font-medium">{value}</span></div> }
function Action({ icon: Icon, label, parentNodeId }: { icon: React.ElementType; label: string; parentNodeId?: string }) { const create = label === "Создать child" && parentNodeId; return <Button disabled={!create} onClick={create ? () => window.location.assign(`/content/pages/new?parentNodeId=${encodeURIComponent(parentNodeId)}`) : undefined} title={create ? undefined : `${label}: отдельная API operation ещё не реализована`} variant="outline"><Icon />{label}</Button> }
function TreeTable({ nodes }: { nodes: ContentNode[] }) { return <div className="mt-3 overflow-x-auto rounded-xl border bg-background"><table className="w-full min-w-[760px] text-left"><thead className="border-b bg-muted/40 text-[10px] text-muted-foreground"><tr><th className="p-3">Страница</th><th>Тип</th><th>Статус</th><th>Владелец</th><th>Quality</th><th>Обновлено</th></tr></thead><tbody className="divide-y">{nodes.map((node) => <tr className="hover:bg-muted/30" key={node.id}><td className="p-3"><Link className="font-medium hover:underline" to={`?selected=${node.id}`}>{node.title}</Link><p className="text-[10px] text-muted-foreground">{node.path}</p></td><td>{node.type}</td><td><ContentStatusBadge status={node.status} /></td><td>{node.owner}</td><td><QualityIndicator level={node.quality} /></td><td>{node.updatedLabel}</td></tr>)}</tbody></table></div> }
