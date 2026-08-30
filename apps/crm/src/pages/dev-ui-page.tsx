import { useState } from "react"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingCottage,
  IconCalendar,
  IconCalendarEvent,
  IconChevronDown,
  IconCircleCheck,
  IconCurrencyRubel,
  IconDots,
  IconError404,
  IconFilter,
  IconFlame,
  IconHome,
  IconInfoCircle,
  IconLayoutCards,
  IconListDetails,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconTable,
  IconUsers,
} from "@tabler/icons-react"

import {
  Assignees,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ClickableCard,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DataTableShell,
  DateNavigator,
  DatePicker,
  EditorSaveStateIndicator,
  FilterSelect,
  IconBox,
  IconButton,
  Input,
  Label,
  LoadingRows,
  MainSecondaryCell,
  PageState,
  PageFrame,
  PageNav,
  PaymentSummary,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  PreparationBlock,
  RowActions,
  SchedulerBookingBlock,
  type SchedulerBookingTone,
  type DateRange,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  SortableHeader,
  StatusBadge,
  SettingsBar,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ViewTabs,
  cn,
} from "@crm/ui"

const assignees = [
  { id: "1", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" },
  { id: "2", initials: "ПС", name: "Павел Сергеев", colorClass: "bg-emerald-100 text-emerald-700" },
  { id: "3", initials: "ОВ", name: "Ольга Волкова", colorClass: "bg-violet-100 text-violet-700" },
]

export function DevUiPage() {
  const [message, setMessage] = useState("Интерактивные состояния готовы к проверке")
  const [pageSection, setPageSection] = useState("all")
  const [view, setView] = useState("agenda")
  const [resource, setResource] = useState("all")
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 7, 24))
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 7, 24),
    to: new Date(2026, 7, 27),
  })

  return (
    <PageFrame>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="outline">Phase 1 · bIkezqK</Badge>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">UI и компоненты</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Интерактивная галерея generated shadcn primitives, CRM-композиций, состояний и responsive-паттернов.
          </p>
        </div>
        <p aria-live="polite" className="rounded-md border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">{message}</p>
      </div>

      <div className="space-y-5">
        <PreviewSection description="Roboto, 12px minimum body, neutral surfaces and semantic colors." title="Foundations">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight">Display / 30</p>
              <p className="text-xl font-semibold">Heading / 20</p>
              <p className="text-sm font-semibold">Section / 14</p>
              <p className="text-xs">Body / 12 · Основной текст CRM</p>
              <p className="text-[11px] text-muted-foreground">Secondary / 11 · Служебная информация</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Background", "bg-background"],
                ["Raised", "bg-surface-raised"],
                ["Subtle", "bg-surface-subtle"],
                ["Sunken", "bg-surface-sunken"],
                ["Info", "bg-info-subtle text-info-foreground"],
                ["Success", "bg-success-subtle text-success-foreground"],
                ["Warning", "bg-warning-subtle text-warning-foreground"],
                ["Danger", "bg-danger-subtle text-danger-foreground"],
              ].map(([label, className]) => (
                <div className={cn("rounded-lg border p-3 text-[11px] font-medium", className)} key={label}>{label}</div>
              ))}
            </div>
          </div>
          <Separator className="my-5" />
          <div className="flex flex-wrap items-center gap-3">
            <IconBox icon={IconHome} label="Нейтральная иконка" />
            <IconBox icon={IconInfoCircle} label="Информация" variant="info" />
            <IconBox icon={IconCircleCheck} label="Успех" variant="success" />
            <IconBox icon={IconAlertTriangle} label="Внимание" variant="warning" />
            <IconBox icon={IconFlame} label="Конфликт" variant="danger" />
            <IconBox icon={IconBuildingCottage} label="Проживание" variant="stay" />
            <IconBox icon={IconSparkles} label="Программа" variant="program" />
          </div>
        </PreviewSection>

        <PreviewSection description="Default, secondary, outline, destructive, icon-only, loading and disabled." title="Buttons and actions">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setMessage("Основное действие выполнено")}>Primary</Button>
            <Button onClick={() => setMessage("Вторичное действие выполнено")} variant="secondary">Secondary</Button>
            <Button onClick={() => setMessage("Контурное действие выполнено")} variant="outline">Outline</Button>
            <Button onClick={() => setMessage("Опасное demo-действие подтверждено")} variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
            <Button aria-busy="true" disabled><span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving</Button>
            <IconButton label="Настройки" onClick={() => setMessage("Открыты demo-настройки")} variant="outline">
              <IconSettings aria-hidden="true" />
            </IconButton>
          </div>
        </PreviewSection>

        <PreviewSection description="Semantic field widths plus invalid, readonly and disabled states." title="Form controls">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="grid items-start gap-4 sm:grid-cols-6">
              <Field className="sm:col-span-4" htmlFor="name" label="Имя клиента"><Input id="name" placeholder="Алексей Морозов" /></Field>
              <Field className="sm:col-span-2" htmlFor="guests" label="Гости"><Input defaultValue="4" id="guests" min="1" type="number" /></Field>
              <Field className="sm:col-span-3" htmlFor="phone" label="Телефон"><Input id="phone" inputMode="tel" placeholder="+7 900 000-00-00" /></Field>
              <Field className="sm:col-span-3" error="Укажите корректную почту" htmlFor="email" label="Email"><Input aria-invalid id="email" defaultValue="wrong@" /></Field>
              <div className="space-y-1.5 sm:col-span-2"><Label>Дата</Label><DatePicker label="Дата брони" onValueChange={setDate} value={date} /></div>
              <div className="space-y-1.5 sm:col-span-4"><Label>Диапазон</Label><DatePicker className="max-w-full" label="Диапазон брони" mode="range" onValueChange={setRange} value={range} /></div>
              <Field className="sm:col-span-6" htmlFor="description" label="Комментарий"><Textarea id="description" placeholder="Детали записи" /></Field>
              <Field className="sm:col-span-3" htmlFor="readonly" label="Readonly"><Input id="readonly" readOnly value="#1048" /></Field>
              <Field className="sm:col-span-3" htmlFor="disabled" label="Disabled"><Input disabled id="disabled" value="Недоступно" /></Field>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Select defaultValue="confirmed">
                  <SelectTrigger aria-label="Статус" className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Черновик</SelectItem>
                    <SelectItem value="confirmed">Подтверждено</SelectItem>
                    <SelectItem value="cancelled">Отмена</SelectItem>
                  </SelectContent>
                </Select>
                <ComboboxDemo onChange={setMessage} />
              </div>
              <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <label className="flex min-h-8 items-center gap-2"><Checkbox defaultChecked /> <span>Только мои</span></label>
                <label className="flex min-h-8 items-center gap-2"><Checkbox disabled /> <span className="text-muted-foreground">Disabled</span></label>
                <label className="flex min-h-8 items-center gap-2"><Switch defaultChecked /> <span>Live updates</span></label>
                <label className="flex min-h-8 items-center gap-2"><Switch disabled /> <span className="text-muted-foreground">Readonly</span></label>
              </div>
              <RadioGroup aria-label="Вид экрана" className="grid-cols-3" defaultValue="cards">
                {[["cards", "Карточки"], ["table", "Таблица"], ["agenda", "Agenda"]].map(([value, label]) => (
                  <label className="flex min-h-10 items-center gap-2 rounded-md border p-2" key={value}>
                    <RadioGroupItem value={value} /> {label}
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </PreviewSection>

        <PreviewSection description="Category identity stays separate from operational and payment status." title="Identity, status and people">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge>Черновик</StatusBadge>
            <StatusBadge tone="info">Подтверждено</StatusBadge>
            <StatusBadge tone="success">Оплачено</StatusBadge>
            <StatusBadge tone="warning">Долг</StatusBadge>
            <StatusBadge tone="danger">Просрочено</StatusBadge>
            <StatusBadge tone="conflict">Конфликт</StatusBadge>
            <Badge className="border-category-stay/20 bg-category-stay-subtle text-category-stay" variant="outline"><IconBuildingCottage /> Дом</Badge>
            <Badge className="border-category-program/20 bg-category-program-subtle text-category-program" variant="outline"><IconSparkles /> Программа</Badge>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-5">
            <Assignees people={assignees} />
            <Assignees onAssign={() => setMessage("Открыт demo-выбор ответственного")} people={[]} />
            <Assignees people={[]} />
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><IconUsers className="size-4" /> 8</span>
          </div>
        </PreviewSection>

        <PreviewSection description="Popover, dropdown, command, tabs and compact settings bar." title="Navigation and overlays">
          <PageNav
            items={[
              { value: "all", label: "Все", icon: IconHome },
              { value: "houses", label: "Дома", icon: IconBuildingCottage },
              { value: "events", label: "Мероприятия", icon: IconCalendarEvent },
            ]}
            onValueChange={(nextValue) => {
              setPageSection(nextValue)
              setMessage(`Выбран раздел: ${nextValue}`)
            }}
            value={pageSection}
          />
          <SettingsBar
            actions={
              <ViewTabs
                items={[
                  { value: "agenda", label: "Agenda", icon: IconListDetails },
                  { value: "cards", label: "Карточки", icon: IconLayoutCards },
                  { value: "table", label: "Таблица", icon: IconTable },
                ]}
                onValueChange={setView}
                value={view}
              />
            }
            className="mt-4"
            filters={
              <FilterSelect
                label="Ресурс"
                onValueChange={setResource}
                options={[
                  { value: "all", label: "Все ресурсы" },
                  { value: "pine", label: "Дом «Сосна»" },
                  { value: "bath", label: "Баня" },
                ]}
                value={resource}
              />
            }
            mobileActions={<Button onClick={() => setMessage("Открыты mobile-фильтры")} size="sm" variant="outline"><IconFilter aria-hidden="true" />Фильтры · 1</Button>}
            primary={
              <DateNavigator
                label="Дата просмотра"
                onNext={() => setDate((current) => shiftCalendarDate(current, 1))}
                onPrevious={() => setDate((current) => shiftCalendarDate(current, -1))}
                onValueChange={setDate}
                value={date}
              />
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger render={<Button size="sm" variant="outline" />}><IconFilter className="size-4" /> Фильтры</PopoverTrigger>
              <PopoverContent>
                <PopoverHeader><PopoverTitle>Фильтры</PopoverTitle><PopoverDescription>Компактная вторичная панель.</PopoverDescription></PopoverHeader>
                <label className="flex items-center gap-2"><Checkbox /> Только с долгом</label>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button aria-label="Ещё действия" size="icon-sm" variant="outline" />}><IconDots className="size-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Действия</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setMessage("Карточка скопирована")}>Дублировать</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>Удаление недоступно в demo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Command className="mt-4 max-w-md rounded-lg border">
            <CommandInput placeholder="Найти команду…" />
            <CommandList>
              <CommandEmpty>Нет совпадений</CommandEmpty>
              <CommandGroup heading="Переход">
                <CommandItem onSelect={() => setMessage("Выбран переход в Обзор")}><IconHome /> Обзор</CommandItem>
                <CommandItem onSelect={() => setMessage("Выбран переход в Брони")}><IconCalendar /> Брони</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PreviewSection>

        <PreviewSection description="Divider rows, sortable headers, overflow and compact payment hierarchy." title="Data display">
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border">
              {["#1048 · Алексей Морозов", "#1049 · Елена Кузнецова", "Очень длинное название клиента и его операционной записи"].map((title) => (
                <ClickableCard className="min-h-14 gap-3 rounded-none border-0 border-b px-3 shadow-none last:border-0" key={title} onClick={() => setMessage(`Открыта строка: ${title}`)}>
                  <IconBox icon={IconBuildingCottage} size="sm" variant="stay" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{title}</span><span className="block text-[11px] text-muted-foreground">Дом «Сосна» · Завтра, 11:00</span></span>
                  <IconChevronDown className="size-4 -rotate-90 text-muted-foreground" />
                </ClickableCard>
              ))}
            </div>
            <DataTableDemo onAction={setMessage} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "0%", paid: 0, total: 100_000 },
              { label: "5%", paid: 5_000, total: 100_000 },
              { label: "50%", paid: 50_000, total: 100_000 },
              { label: "95%", paid: 95_000, total: 100_000 },
              { label: "100%", paid: 100_000, total: 100_000 },
            ].map((payment) => (
              <div className="min-w-0 rounded-lg border p-3" key={payment.label}>
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">{payment.label}</p>
                <PaymentSummary paid={payment.paid} total={payment.total} />
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection description="Loading, empty, error, success, dirty/saving, readonly, conflict and narrow overflow." title="States">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StateTile title="Loading"><LoadingRows count={2} /></StateTile>
            <StateTile title="Empty"><PageState icon={IconSearch} title="Ничего не найдено">Измените фильтры.</PageState></StateTile>
            <StateTile title="Error"><PageState actionLabel="Повторить" icon={IconError404} onAction={() => setMessage("Повторная загрузка запущена")} title="Ошибка загрузки" tone="danger" /></StateTile>
            <StateTile title="Success"><EditorSaveStateIndicator detail="Изменения записаны" state="saved" /></StateTile>
            <StateTile title="Dirty / Saving"><div className="flex flex-col items-start gap-2"><EditorSaveStateIndicator state="dirty" /><EditorSaveStateIndicator state="saving" /></div></StateTile>
            <StateTile title="Conflict"><EditorSaveStateIndicator detail="Запись изменил другой сотрудник" state="conflict" /></StateTile>
            <StateTile className="w-[280px] max-w-full" title="Narrow / overflow"><p className="truncate text-xs font-medium">Очень длинное имя клиента для проверки переполнения</p><Button className="mt-3 w-full" disabled variant="outline">Readonly action</Button></StateTile>
          </div>
        </PreviewSection>

        <PreviewSection description="Route editor stays inside global shell; fixed chrome fragments shown without implementing an editor screen." title="Editor chrome fragments">
          <div className="overflow-hidden rounded-lg border bg-surface-sunken">
            <div className="flex min-h-14 items-center gap-2 border-b bg-background px-3">
              <Tooltip>
                <TooltipTrigger render={<Button aria-label="Назад" onClick={() => setMessage("Возврат в предыдущий контекст") } size="icon-sm" variant="ghost" />}>
                  <IconArrowLeft aria-hidden="true" className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Назад</TooltipContent>
              </Tooltip>
              <div className="min-w-0 flex-1"><p className="text-[10px] text-muted-foreground">Бронь #1048</p><p className="truncate text-xs font-semibold">Алексей Морозов</p></div>
              <StatusBadge tone="info">Подтверждено</StatusBadge>
            </div>
            <div className="grid min-h-64 md:grid-cols-[minmax(0,1fr)_minmax(280px,32%)]">
              <div className="p-4"><Tabs defaultValue="main"><TabsList variant="line"><TabsTrigger value="main">Основное</TabsTrigger><TabsTrigger value="payments">Оплаты</TabsTrigger></TabsList><TabsContent className="pt-4" value="main"><Skeleton className="h-24 w-full" /></TabsContent><TabsContent className="pt-4" value="payments"><Skeleton className="h-16 w-full" /></TabsContent></Tabs></div>
              <aside className="border-t bg-background p-4 md:border-l md:border-t-0"><p className="font-semibold">Сводка</p><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Заезд</span><span>Завтра, 11:00</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Гости</span><span>4</span></div><div className="flex justify-between gap-4 border-t pt-2"><span className="text-muted-foreground">К оплате</span><span className="font-medium">10 000 ₽</span></div></div></aside>
            </div>
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-t bg-background px-3 py-2"><EditorSaveStateIndicator state="dirty" /><div className="flex gap-2"><Button onClick={() => setMessage("Редактор закрыт")} size="sm" variant="outline">Закрыть</Button><Button onClick={() => setMessage("Демо editor chrome сохранёно")} size="sm">Сохранить</Button></div></div>
          </div>
        </PreviewSection>

        <PreviewSection description="Parametric neutral blocks, height-aware density, independent preparation interval and consumer-owned resize slots." title="Scheduler blocks">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SchedulerExample
              height={64}
              id="#1048"
              onClick={() => setMessage("Открыта компактная бронь #1048")}
              status="Подтверждено"
              time="11:00–12:00"
              title="Алексей Морозов"
              tone="confirmed"
            />
            <SchedulerExample
              id="#1052"
              onClick={() => setMessage("Открыта ожидающая бронь #1052")}
              status="Ожидает подтверждения"
              time="13:00–15:00"
              title="Елена Кузнецова"
              tone="pending"
            />
            <SchedulerExample
              id="#1061"
              onClick={() => setMessage("Открыт конфликт брони #1061")}
              status="Конфликт"
              time="15:00–18:00"
              title="Мария Соколова"
              tone="conflict"
            />
            <SchedulerExample
              height={148}
              id="#1064"
              onClick={() => setMessage("Открыта оплаченная бронь #1064")}
              status="Оплачено"
              time="18:00–21:00"
              title="Игорь Лебедев"
              tone="paid"
            />
          </div>
        </PreviewSection>
      </div>
    </PageFrame>
  )
}

function PreviewSection({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <Card><CardHeader className="border-b"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="pt-5">{children}</CardContent></Card>
}

function Field({ children, className, error, htmlFor, label }: { children: React.ReactNode; className?: string; error?: string; htmlFor: string; label: string }) {
  return <div className={cn("space-y-1.5", className)}><Label htmlFor={htmlFor}>{label}</Label>{children}{error ? <p className="text-[11px] text-danger-foreground">{error}</p> : null}</div>
}

function StateTile({ children, className, title }: { children: React.ReactNode; className?: string; title: string }) {
  return <div className={cn("min-w-0 rounded-lg border bg-background p-3", className)}><p className="mb-3 text-[10px] font-semibold uppercase text-muted-foreground">{title}</p>{children}</div>
}

function ComboboxDemo({ onChange }: { onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("Дом «Сосна»")
  return <Popover onOpenChange={setOpen} open={open}><PopoverTrigger className="inline-flex h-9 min-w-48 items-center justify-between gap-2 rounded-md border px-3 text-sm"><span className="truncate">{value}</span><IconChevronDown className="size-4" /></PopoverTrigger><PopoverContent className="p-1"><Command><CommandInput placeholder="Найти ресурс…" /><CommandList><CommandEmpty>Нет ресурсов</CommandEmpty><CommandGroup>{["Дом «Сосна»", "Дом «Берёза»", "Баня"].map((option) => <CommandItem key={option} onSelect={() => { setValue(option); setOpen(false); onChange(`Выбран ресурс: ${option}`) }}>{option}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>
}

function DataTableDemo({ onAction }: { onAction: (message: string) => void }) {
  const [sort, setSort] = useState<"asc" | "desc">("asc")
  const rows = [...[{ id: 1048, client: "Алексей Морозов", total: 28000 }, { id: 1031, client: "Игорь Лебедев", total: 24000 }]].sort((a, b) => sort === "asc" ? a.id - b.id : b.id - a.id)
  return (
    <DataTableShell tableClassName="min-w-[460px]">
      <thead className="border-b bg-muted/45">
        <tr>
          <SortableHeader active direction={sort} onSort={() => setSort((current) => current === "asc" ? "desc" : "asc")}>#ID</SortableHeader>
          <th className="px-3 py-2 text-xs font-normal text-muted-foreground">Клиент</th>
          <th className="px-3 py-2 text-right text-xs font-normal text-muted-foreground">Сумма</th>
          <th className="w-12 px-2 py-2"><span className="sr-only">Действия</span></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr className="hover:bg-muted/35" key={row.id}>
            <MainSecondaryCell main={`#${row.id}`} secondary="Заказ-наряд" />
            <MainSecondaryCell main={row.client} secondary="+7 900 000-00-00" />
            <MainSecondaryCell className="text-right tabular-nums"><IconCurrencyRubel aria-hidden="true" className="mr-1 inline size-3" />{row.total.toLocaleString("ru-RU")}</MainSecondaryCell>
            <RowActions>
              <IconButton label={`Действия записи #${row.id}`} onClick={() => onAction(`Открыты действия #${row.id}`)} size="icon-xs" variant="ghost">
                <IconDots aria-hidden="true" />
              </IconButton>
            </RowActions>
          </tr>
        ))}
      </tbody>
    </DataTableShell>
  )
}

function SchedulerExample({
  height = 112,
  id,
  onClick,
  status,
  time,
  title,
  tone,
}: {
  height?: number
  id: string
  onClick: () => void
  status: string
  time: string
  title: string
  tone: SchedulerBookingTone
}) {
  const resizeSlot = <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-muted-foreground/35 ring-2 ring-background" />
  return (
    <div className="space-y-1.5">
      <SchedulerBookingBlock
        ariaLabel={`Открыть бронь ${id}: ${status}`}
        bottomResizeSlot={resizeSlot}
        guests={4}
        height={height}
        id={id}
        onClick={onClick}
        secondary="+7 900 000-00-00"
        statusLabel={status}
        timeLabel={time}
        title={title}
        tone={tone}
        topResizeSlot={resizeSlot}
      />
      <PreparationBlock label="Подготовка" timeLabel="30 мин" tone={tone === "conflict" ? "danger" : "neutral"} />
    </div>
  )
}

function shiftCalendarDate(value: Date | undefined, days: number) {
  const nextValue = new Date(value ?? new Date())
  nextValue.setDate(nextValue.getDate() + days)
  return nextValue
}
