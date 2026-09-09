import { useEffect, useState } from "react"
import { IconBell, IconBrandDatabricks, IconCheck, IconChevronDown, IconExternalLink, IconLogout, IconPlus, IconSearch, IconWorld } from "@tabler/icons-react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback, Button, Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, StatusBadge, Tooltip, TooltipContent, TooltipTrigger, cn } from "@crm/ui"

import { hasAdminCapability, mobileNav, navGroups, quickCreateItems, routeTitle } from "@admin/app/navigation"
import { cmsRepository } from "@admin/data/cms-repository"
import { useAdminAuthSession } from "@admin/features/auth-session-context"

export function AdminShell() {
  return <div className="min-h-screen bg-surface-sunken"><a className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0" href="#admin-main">К содержимому</a><AdminSidebar /><AdminTopbar /><main className="min-h-[calc(100vh-3.5rem)] pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:ml-60 lg:pb-0" id="admin-main"><Outlet /></main><AdminMobileNav /></div>
}

function AdminSidebar() {
  const api = cmsRepository.mode === "api"
  const auth = useAdminAuthSession()
  const displayName = auth.user.displayName ?? auth.user.name
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
    <div className="flex h-14 items-center gap-2 border-b px-3">
      <DropdownMenu><DropdownMenuTrigger render={<Button className="h-10 flex-1 justify-start px-2" variant="ghost" />}><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><IconWorld className="size-[18px]" /></span><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">Свистоплясово</span><span className="block text-[10px] text-muted-foreground">CMS · {api ? "Подключено" : "Демо"}</span></span><IconChevronDown className="size-3" /></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-56"><DropdownMenuLabel>Приложение</DropdownMenuLabel><DropdownMenuItem disabled><IconCheck /> CMS</DropdownMenuItem><DropdownMenuItem onClick={() => { window.location.href = "/crm" }}><IconBrandDatabricks /> CRM <span className="ml-auto text-[10px] text-muted-foreground">Операции</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </div>
    <nav aria-label="CMS" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{navGroups.map((group) => { const items = group.items.filter((item) => hasAdminCapability(auth.user.capabilities, item.capability)); return items.length ? <div className="mb-4" key={group.label}><p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[.06em] text-muted-foreground">{group.label}</p><div className="space-y-0.5">{items.map((item) => <AdminNavLink item={item} key={item.href} />)}</div></div> : null })}</nav>
    <div className="border-t p-3"><div className="flex items-center gap-2"><Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{displayName}</p><p className="truncate text-[10px] text-muted-foreground">{api ? roleLabel(auth.user.role) : "Fixture · издатель"}</p></div></div></div>
  </aside>
}

function AdminNavLink({ item }: { item: (typeof navGroups)[number]["items"][number] }) {
  const location = useLocation()
  const active = location.pathname === item.href || (item.match ? location.pathname.startsWith(item.match) : false)
  return <NavLink className={cn("flex min-h-9 items-center gap-2.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", active && "bg-sidebar-accent text-sidebar-accent-foreground")} end={item.href === "/"} to={item.href}><item.icon className="size-4 shrink-0" stroke={1.8} /><span className="truncate">{item.label}</span></NavLink>
}

function AdminTopbar() {
  const location = useLocation(); const navigate = useNavigate(); const [searchOpen, setSearchOpen] = useState(false); const [logoutPending, setLogoutPending] = useState(false); const [logoutError, setLogoutError] = useState<string | null>(null)
  const api = cmsRepository.mode === "api"
  const auth = useAdminAuthSession()
  const displayName = auth.user.displayName ?? auth.user.name
  const createItems = quickCreateItems.filter((item) => hasAdminCapability(auth.user.capabilities, item.capability))
  const logout = async () => { setLogoutPending(true); setLogoutError(null); try { await auth.logout() } catch (error) { setLogoutError(error instanceof Error ? error.message : "Не удалось выйти") } finally { setLogoutPending(false) } }
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true) } }; document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler) }, [])
  return <>
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5 lg:ml-60">
      <div className="min-w-0 flex-1"><span className="hidden text-xs text-muted-foreground sm:inline">CMS · </span><h1 className="inline truncate text-sm font-semibold">{routeTitle(location.pathname)}</h1></div>
      <StatusBadge className="hidden md:inline-flex" tone="info">{api ? "Подключено" : "Демо"}</StatusBadge>
      <Button className="hidden w-52 justify-start text-muted-foreground md:flex" onClick={() => setSearchOpen(true)} size="sm" variant="outline"><IconSearch /><span className="flex-1 text-left">Навигация</span><kbd className="text-[9px]">⌘K</kbd></Button>
      <Tooltip><TooltipTrigger render={<Button aria-label="Открыть сайт" disabled={api} onClick={() => navigate("/?notice=production-preview")} size="icon-sm" variant="ghost" />}><IconExternalLink /></TooltipTrigger><TooltipContent>{api ? "Предпросмотр сайта подключается" : "Открыть демо-предпросмотр"}</TooltipContent></Tooltip>
      {createItems.length ? <DropdownMenu><DropdownMenuTrigger render={<Button size="sm" />}><IconPlus /> <span className="hidden sm:inline">Создать</span></DropdownMenuTrigger><DropdownMenuContent align="end">{createItems.map((item) => <DropdownMenuItem key={item.href} onClick={() => navigate(item.href)}><item.icon />{item.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
      <Button aria-label="Уведомления" disabled={api} onClick={() => window.alert("Новых демо-уведомлений нет")} size="icon-sm" title={api ? "Уведомления подключаются" : undefined} variant="ghost"><IconBell /></Button>
      <DropdownMenu><DropdownMenuTrigger aria-label="Профиль CMS" render={<button className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button" />}><Avatar className="size-8"><AvatarFallback className="text-[10px]">{initials(displayName)}</AvatarFallback></Avatar></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60"><DropdownMenuLabel><span className="block truncate text-xs">{displayName}</span><span className="block truncate text-[10px] font-normal text-muted-foreground">{auth.user.email ?? roleLabel(auth.user.role)}</span></DropdownMenuLabel>{logoutError ? <DropdownMenuLabel className="text-[10px] font-normal text-danger-foreground">{logoutError}</DropdownMenuLabel> : null}<DropdownMenuSeparator /><DropdownMenuItem disabled={logoutPending} onClick={() => { void logout() }}><IconLogout aria-hidden="true" /> {logoutPending ? "Выходим…" : "Выйти"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </header>
    <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} onSelect={(href) => { setSearchOpen(false); navigate(href) }} />
  </>
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "CMS"
}

function roleLabel(role: string) {
  return ({ admin: "Администратор", technical_admin: "Технический администратор", manager: "Менеджер", lead_manager: "Старший менеджер", manager_supervisor: "Руководитель менеджеров", supervisor: "Руководитель", readonly: "Только просмотр" } as Record<string, string>)[role] ?? role
}

function GlobalSearch({ onOpenChange, onSelect, open }: { onOpenChange: (value: boolean) => void; onSelect: (href: string) => void; open: boolean }) {
  const { user } = useAdminAuthSession()
  return <CommandDialog description="Страницы, медиа и связанные записи CRM" onOpenChange={onOpenChange} open={open} title="Поиск по CMS"><Command><CommandInput placeholder="Название, URL, CRM-сущность, файл…" /><CommandList><CommandEmpty>Ничего не найдено</CommandEmpty>{navGroups.slice(0, 3).map((group) => { const items = group.items.filter((item) => hasAdminCapability(user.capabilities, item.capability)); return items.length ? <CommandGroup heading={group.label} key={group.label}>{items.map((item) => <CommandItem key={item.href} onSelect={() => onSelect(item.href)}><item.icon />{item.label}</CommandItem>)}</CommandGroup> : null })}</CommandList></Command></CommandDialog>
}

function AdminMobileNav() {
  const location = useLocation()
  const { user } = useAdminAuthSession()
  const items = mobileNav.filter((item) => hasAdminCapability(user.capabilities, item.capability))
  return <nav aria-label="Мобильная навигация" className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(3.75rem+env(safe-area-inset-bottom))] border-t bg-background/96 pb-[env(safe-area-inset-bottom)] lg:hidden">{items.map((item) => { const active = location.pathname === item.href || (item.match ? location.pathname.startsWith(item.match) : false); return <NavLink className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[9px] text-muted-foreground", active && "text-primary", item.label === "Создать" && "-mt-3")} key={item.href} to={item.href}><span className={cn("flex size-7 items-center justify-center rounded-lg", item.label === "Создать" && "size-10 rounded-full bg-primary text-primary-foreground shadow-md")}><item.icon className="size-4" /></span><span className="truncate">{item.label}</span></NavLink> })}</nav>
}
