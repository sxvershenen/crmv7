import { useEffect, useState } from "react"
import {
  IconBed,
  IconArrowLeft,
  IconBell,
  IconBolt,
  IconBuildingCottage,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconChecklist,
  IconConfetti,
  IconMessageQuestion,
  IconPlus,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUser,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react"
import { useLocation, useNavigate } from "react-router-dom"

import {
  Avatar,
  AvatarFallback,
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  ConfirmationDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crm/ui"

import { useEditorLayout } from "@app/app/editor-layout-context"
import { getSectionTitle, navGroups, quickCreateItems } from "@app/app/navigation"
import { useAuthSession } from "@app/features/auth-session-context"
import {
  globalSearchKindLabels,
  globalSearchKinds,
  globalSearchRepository,
  type GlobalSearchKind,
  type GlobalSearchRepository,
  type GlobalSearchResult,
} from "@app/data/global-search-repository"

const searchKindIcons: Record<GlobalSearchKind, React.ElementType> = {
  booking: IconBed,
  customer: IconUsers,
  event: IconConfetti,
  lead: IconMessageQuestion,
  program: IconCalendarEvent,
  resource: IconBuildingCottage,
  task: IconChecklist,
  team: IconUsersGroup,
}

export function AppTopbar({ searchRepository = globalSearchRepository }: { searchRepository?: GlobalSearchRepository }) {
  const auth = useAuthSession()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [notificationsRead, setNotificationsRead] = useState(false)
  const [confirmLeadBooking, setConfirmLeadBooking] = useState(false)
  const title = getSectionTitle(location.pathname)
  const { chrome: editorChrome } = useEditorLayout()
  const profileName = auth?.user.name ?? "Марина Кириллова"
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "?"

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    let active = true
    if (!searchQuery.trim()) {
      setSearchResults([])
      return () => { active = false }
    }
    void searchRepository.search(searchQuery).then((results) => {
      if (active) setSearchResults(results)
    })
    return () => { active = false }
  }, [searchQuery, searchRepository])

  const selectRoute = (href: string) => {
    setSearchOpen(false)
    setSearchQuery("")
    navigate(href)
  }
  const createRoute = (href: string) => {
    if (href === "/bookings/new" && location.pathname.startsWith("/leads/") && editorChrome) {
      setConfirmLeadBooking(true)
      return
    }
    navigate(href)
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-5 lg:ml-60">
        {editorChrome ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger render={<Button aria-label="Назад" onClick={editorChrome.onBack} size="icon-sm" variant="ghost" />}>
                <IconArrowLeft aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Назад</TooltipContent>
            </Tooltip>
            <h1 className="min-w-0 truncate text-sm font-semibold">{editorChrome.title}</h1>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{editorChrome.idLabel}</span>
            {editorChrome.mobileStatus ? <div className="ml-auto min-w-0 max-w-28 shrink md:hidden" data-slot="editor-mobile-status">{editorChrome.mobileStatus}</div> : null}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">CRM</span>
            <IconChevronRight aria-hidden="true" className="hidden size-3 text-muted-foreground sm:block" />
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            {location.pathname === "/" ? (
              <span className="hidden text-xs text-muted-foreground md:inline">· Сегодня, 23 авг</span>
            ) : null}
          </div>
        )}

        <button
          aria-label="Открыть поиск"
          className="hidden h-8 w-56 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-xs text-muted-foreground hover:bg-muted md:flex"
          onClick={() => setSearchOpen(true)}
          type="button"
        >
          <IconSearch aria-hidden="true" className="size-4" />
          <span className="flex-1 text-left">Поиск</span>
          <kbd className="rounded border bg-background px-1 py-0.5 text-[9px]">⌘K</kbd>
        </button>

        <Tooltip>
          <TooltipTrigger
            aria-label="Открыть поиск"
            className={editorChrome ? "hidden" : "inline-flex size-10 items-center justify-center rounded-md hover:bg-muted md:hidden"}
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch aria-hidden="true" className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent>Поиск</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="hidden sm:flex" size="sm" />}>
            <IconPlus aria-hidden="true" className="size-4" />
            Создать
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Новая запись</DropdownMenuLabel>
            {quickCreateItems.map((item) => (
              <DropdownMenuItem key={item.href} onClick={() => createRoute(item.href)}>
                <item.icon aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger
            aria-label={notificationsRead ? "Уведомления" : "Уведомления: 2 новых"}
            className={editorChrome ? "relative hidden size-10 items-center justify-center rounded-md hover:bg-muted md:inline-flex" : "relative inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"}
          >
            <IconBell aria-hidden="true" className="size-[18px]" />
            {!notificationsRead ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-danger" /> : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 gap-3">
            <PopoverHeader>
              <PopoverTitle>Уведомления</PopoverTitle>
              <PopoverDescription>{notificationsRead ? "Новых нет" : "2 новых события"}</PopoverDescription>
            </PopoverHeader>
            {!notificationsRead ? (
              <div className="divide-y rounded-md border text-xs">
                <button className="block w-full p-3 text-left hover:bg-muted" onClick={() => navigate("/bookings/1048")} type="button">
                  <span className="font-medium">Конфликт в брони #1048</span>
                  <span className="mt-1 block text-muted-foreground">5 мин назад</span>
                </button>
                <button className="block w-full p-3 text-left hover:bg-muted" onClick={() => navigate("/leads/1079")} type="button">
                  <span className="font-medium">Новая заявка #1079</span>
                  <span className="mt-1 block text-muted-foreground">18 мин назад</span>
                </button>
              </div>
            ) : null}
            <Button disabled={notificationsRead} onClick={() => setNotificationsRead(true)} size="sm" variant="outline">
              <IconCheck aria-hidden="true" />
              Отметить все прочитанными
            </Button>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Меню профиля" className={editorChrome ? "hidden rounded-full focus-visible:ring-2 focus-visible:ring-ring md:block" : "rounded-full focus-visible:ring-2 focus-visible:ring-ring"}>
            <Avatar className="size-8">
              <AvatarFallback className="bg-neutral-200 text-[10px] font-semibold">{profileInitials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{profileName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <IconUser aria-hidden="true" /> Профиль
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <IconSettings aria-hidden="true" /> Настройки
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {auth ? <DropdownMenuItem onClick={() => { void auth.logout() }}><IconLogout aria-hidden="true" /> Выйти</DropdownMenuItem> : <DropdownMenuItem disabled><IconBolt aria-hidden="true" /> Выход недоступен</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <CommandDialog
        description="Поиск по людям, записям и разделам CRM"
        onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearchQuery("") }}
        open={searchOpen}
        title="Поиск по CRM"
      >
        <Command shouldFilter={false}>
          <CommandInput autoFocus onValueChange={setSearchQuery} placeholder="Найти #ID, телефон, e-mail, имя или ресурс…" value={searchQuery} />
          <CommandList>
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            {!searchQuery.trim() ? navGroups.map((group) => (
              <CommandGroup heading={group.label} key={group.label}>
                {group.items.map((item) => (
                  <CommandItem key={item.href} onSelect={() => selectRoute(item.href)} value={item.label}>
                    <item.icon aria-hidden="true" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )) : globalSearchKinds.map((kind) => {
              const results = searchResults.filter((result) => result.kind === kind)
              if (!results.length) return null
              const Icon = searchKindIcons[kind]
              return <CommandGroup heading={globalSearchKindLabels[kind]} key={kind}>
                {results.map((result) => <CommandItem className="items-start" key={`${kind}:${result.id}`} onSelect={() => selectRoute(result.href)} value={`${kind}:${result.id}`}><Icon aria-hidden="true" className="mt-0.5" /><span className="min-w-0 flex-1"><span className="block truncate text-xs">{result.title}</span><span className="block truncate text-[10px] text-muted-foreground">{result.meta}</span></span></CommandItem>)}
              </CommandGroup>
            })}
          </CommandList>
        </Command>
      </CommandDialog>
      <ConfirmationDialog confirmLabel="Создать бронь" description={`Создать бронь из заявки для клиента «${editorChrome?.title ?? "Клиент"}»? Клиент и связь с заявкой будут перенесены.`} onConfirm={() => { const leadId = location.pathname.split("/").at(-1) ?? ""; navigate(`/bookings/new?leadId=${encodeURIComponent(leadId)}&clientName=${encodeURIComponent(editorChrome?.title ?? "")}`) }} onOpenChange={setConfirmLeadBooking} open={confirmLeadBooking} title="Создать бронь из заявки?" />
    </>
  )
}
