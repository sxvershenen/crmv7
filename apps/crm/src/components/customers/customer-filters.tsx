import { useState } from "react"
import { IconFilter, IconRotateClockwise } from "@tabler/icons-react"

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  FilterSelect,
  SettingsBar,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@crm/ui"

import type { CustomerChannel, CustomerFlag, CustomerType } from "@app/entities/customers"
import { customerChannels, customerFlagLabels, customerFlags, customerTypeLabels, customerTypes } from "@app/entities/customers"

type CustomerFiltersProps = {
  type: CustomerType | "all"
  channel: CustomerChannel | "all"
  flags: CustomerFlag[]
  lastVisitDays: 30 | 60 | 90 | null
  onTypeChange: (value: CustomerType | "all") => void
  onChannelChange: (value: CustomerChannel | "all") => void
  onFlagToggle: (flag: CustomerFlag) => void
  onLastVisitChange: (days: 30 | 60 | 90 | null) => void
  onReset: () => void
}

const typeOptions = [
  { label: "Все типы", value: "all" },
  ...customerTypes.map((value) => ({ label: customerTypeLabels[value], value })),
]

const channelOptions = [
  { label: "Все каналы", value: "all" },
  ...customerChannels.map((value) => ({ label: value, value })),
]

const visitOptions = [
  { label: "Любое посещение", value: "all" },
  { label: "Посещали за 30 дней", value: "30" },
  { label: "Посещали за 60 дней", value: "60" },
  { label: "Посещали за 90 дней", value: "90" },
]

export function CustomerFilters(props: CustomerFiltersProps) {
  const activeCount = Number(props.type !== "all") + Number(props.channel !== "all") + props.flags.length + Number(props.lastVisitDays !== null)

  return (
    <SettingsBar
      actions={activeCount > 0 ? <Button onClick={props.onReset} size="xs" variant="ghost"><IconRotateClockwise aria-hidden="true" />Сбросить · {activeCount}</Button> : undefined}
      filters={
        <>
          <FilterSelect className="w-44" label="Канал" onValueChange={(value) => props.onChannelChange(value as CustomerChannel | "all")} options={channelOptions} value={props.channel} />
          <FilterSelect className="w-48" label="Последнее посещение" onValueChange={(value) => props.onLastVisitChange(value === "all" ? null : Number(value) as 30 | 60 | 90)} options={visitOptions} value={props.lastVisitDays === null ? "all" : String(props.lastVisitDays)} />
          <FlagMenu {...props} activeCount={props.flags.length} />
        </>
      }
      mobileActions={<MobileCustomerFilters {...props} activeCount={activeCount} />}
      primary={<FilterSelect className="min-w-36" label="Тип клиента" onValueChange={(value) => props.onTypeChange(value as CustomerType | "all")} options={typeOptions} value={props.type} />}
    />
  )
}

function FlagMenu({ activeCount, flags, onFlagToggle }: CustomerFiltersProps & { activeCount: number }) {
  const [open, setOpen] = useState(false)

  const toggleFlagAndClose = (flag: CustomerFlag) => {
    onFlagToggle(flag)
    setOpen(false)
  }

  return (
    <DropdownMenu onOpenChange={(nextOpen) => setOpen(nextOpen)} open={open}>
      <DropdownMenuTrigger render={<Button aria-label="Признаки клиентов" className="text-xs font-normal" size="sm" variant="outline" />}>
        <IconFilter aria-hidden="true" />Признаки
        {activeCount > 0 ? <Badge className="min-w-5 justify-center font-normal" variant="secondary">{activeCount}</Badge> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-normal">Показать клиентов</DropdownMenuLabel>
          {customerFlags.map((flag) => (
            <DropdownMenuCheckboxItem checked={flags.includes(flag)} className="text-xs" key={flag} onCheckedChange={() => toggleFlagAndClose(flag)}>
              {customerFlagLabels[flag]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileCustomerFilters({ activeCount, ...props }: CustomerFiltersProps & { activeCount: number }) {
  const [open, setOpen] = useState(false)

  const applyAndClose = (apply: () => void) => {
    apply()
    setOpen(false)
  }

  return (
    <Sheet onOpenChange={(nextOpen) => setOpen(nextOpen)} open={open}>
      <SheetTrigger render={<Button aria-label="Фильтры клиентов" className="text-xs font-normal" size="sm" variant="outline" />}>
        <IconFilter aria-hidden="true" />
        {activeCount > 0 ? <Badge className="min-w-5 justify-center font-normal" variant="secondary">{activeCount}</Badge> : null}
      </SheetTrigger>
      <SheetContent className="w-full" side="bottom">
        <SheetHeader>
          <SheetTitle>Фильтры клиентов</SheetTitle>
          <SheetDescription>Тип, канал, признаки и давность последнего посещения.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          <FilterSelect className="max-w-none" label="Тип клиента" onValueChange={(value) => applyAndClose(() => props.onTypeChange(value as CustomerType | "all"))} options={typeOptions} value={props.type} />
          <FilterSelect className="max-w-none" label="Канал" onValueChange={(value) => applyAndClose(() => props.onChannelChange(value as CustomerChannel | "all"))} options={channelOptions} value={props.channel} />
          <FilterSelect className="max-w-none" label="Последнее посещение" onValueChange={(value) => applyAndClose(() => props.onLastVisitChange(value === "all" ? null : Number(value) as 30 | 60 | 90))} options={visitOptions} value={props.lastVisitDays === null ? "all" : String(props.lastVisitDays)} />
          <div className="rounded-lg border p-2">
            <p className="px-1 pb-1 text-[11px] font-normal text-muted-foreground">Признаки</p>
            {customerFlags.map((flag) => (
              <Button className="w-full justify-between font-normal" key={flag} onClick={() => applyAndClose(() => props.onFlagToggle(flag))} size="sm" variant={props.flags.includes(flag) ? "secondary" : "ghost"}>
                {customerFlagLabels[flag]}<span aria-hidden="true">{props.flags.includes(flag) ? "✓" : ""}</span>
              </Button>
            ))}
          </div>
          {activeCount > 0 ? <Button className="sm:col-span-2" onClick={() => applyAndClose(props.onReset)} size="sm" variant="outline"><IconRotateClockwise aria-hidden="true" />Сбросить фильтры</Button> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
