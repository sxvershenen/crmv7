import { useState } from "react"
import { IconAdjustmentsHorizontal, IconCalendarEvent, IconFilter, IconSettings, IconTable } from "@tabler/icons-react"

import {
  Badge,
  Button,
  DateNavigator,
  FilterSelect,
  IconButton,
  PageNav,
  SettingsBar,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ViewTabs,
  type DateRange,
} from "@crm/ui"

import type { ProgramCategory, ProgramPeriod, ProgramRunView, ProgramSection } from "@app/entities/programs"
import { programRegistrationStatuses, programRegistrationStatusMeta, programRunStatuses, programRunStatusMeta, programSectionLabels, programSections } from "@app/entities/programs"
import { fromIso, shiftIso, toIso } from "./program-format"

type ProgramsControlsProps = {
  activeFilters: number
  categories: ProgramCategory[]
  category: string
  date: string
  onCategoryChange: (value: string) => void
  onDateChange: (value: string) => void
  onOpenCategories: () => void
  onPeriodChange: (value: ProgramPeriod) => void
  onRangeChange: (from: string, to: string) => void
  onReset: () => void
  onStatusChange: (value: string) => void
  onViewChange: (value: ProgramRunView) => void
  period: ProgramPeriod
  rangeEnd: string
  section: ProgramSection
  status: string
  view: ProgramRunView
}

export function ProgramsNav({ onChange, value }: { onChange: (value: ProgramSection) => void; value: ProgramSection }) {
  return (
    <PageNav
      ariaLabel="Разделы программ"
      items={programSections.map((item) => ({ label: programSectionLabels[item], value: item }))}
      onValueChange={(next) => onChange(next as ProgramSection)}
      value={value}
    />
  )
}

export function ProgramsControls(props: ProgramsControlsProps) {
  const primary = props.section === "templates" ? (
    <CategorySelect categories={props.categories} onChange={props.onCategoryChange} value={props.category} />
  ) : props.view === "scheduler" && props.section === "runs" ? (
    <DateNavigator
      label="Дата проведений"
      nextLabel="Следующий период"
      onNext={() => props.onDateChange(shiftIso(props.date, props.period === "week" ? 7 : 3))}
      onPrevious={() => props.onDateChange(shiftIso(props.date, props.period === "week" ? -7 : -3))}
      onValueChange={(next) => next && props.onDateChange(toIso(next))}
      previousLabel="Предыдущий период"
      value={fromIso(props.date)}
    />
  ) : (
    <RangeControl {...props} />
  )

  const views = props.section === "runs" ? (
    <ViewTabs
      ariaLabel="Вид проведений"
      items={[
        { icon: IconTable, label: "Таблица", value: "table" },
        { icon: IconCalendarEvent, label: "Scheduler", value: "scheduler" },
      ]}
      onValueChange={(next) => props.onViewChange(next as ProgramRunView)}
      value={props.view}
    />
  ) : null

  const filters = (
    <>
      {props.section !== "templates" ? <CategorySelect categories={props.categories} onChange={props.onCategoryChange} value={props.category} /> : null}
      {props.section !== "templates" ? <StatusSelect onChange={props.onStatusChange} section={props.section} value={props.status} /> : null}
      {props.section === "runs" && props.view === "scheduler" ? (
        <FilterSelect
          className="w-32"
          label="Период"
          onValueChange={(next) => props.onPeriodChange(next as ProgramPeriod)}
          options={[{ label: "3 дня", value: "3days" }, { label: "Неделя", value: "week" }]}
          value={props.period}
        />
      ) : null}
    </>
  )

  return (
    <SettingsBar
      actions={
        <>
          {views}
          <IconButton label="Управление категориями программ" onClick={props.onOpenCategories} variant="outline"><IconSettings aria-hidden="true" /></IconButton>
        </>
      }
      filters={filters}
      mobileActions={<>{views}<MobileFilters {...props} /><IconButton label="Категории программ" onClick={props.onOpenCategories} variant="outline"><IconSettings aria-hidden="true" /></IconButton></>}
      mobilePrimary={primary}
      primary={primary}
    />
  )
}

function RangeControl({ date, onRangeChange, rangeEnd, section }: ProgramsControlsProps) {
  const value: DateRange = { from: fromIso(date), to: fromIso(rangeEnd) }
  const duration = Math.max(1, Math.round((fromIso(rangeEnd).getTime() - fromIso(date).getTime()) / 86_400_000) + 1)
  const shift = (direction: number) => onRangeChange(shiftIso(date, duration * direction), shiftIso(rangeEnd, duration * direction))
  return (
    <DateNavigator
      label={section === "runs" ? "Диапазон проведений" : "Диапазон регистраций"}
      mode="range"
      nextLabel="Следующий диапазон"
      onNext={() => shift(1)}
      onPrevious={() => shift(-1)}
      onValueChange={(next) => next?.from && onRangeChange(toIso(next.from), toIso(next.to ?? next.from))}
      previousLabel="Предыдущий диапазон"
      value={value}
    />
  )
}

function CategorySelect({ categories, onChange, value }: { categories: ProgramCategory[]; onChange: (value: string) => void; value: string }) {
  return (
    <FilterSelect
      className="w-40"
      label="Категория программ"
      onValueChange={onChange}
      options={[{ label: "Все категории", value: "all" }, ...categories.map((item) => ({ label: item.name, value: item.id }))]}
      value={value}
    />
  )
}

function StatusSelect({ onChange, section, value }: { onChange: (value: string) => void; section: ProgramSection; value: string }) {
  const options = section === "runs"
    ? programRunStatuses.map((item) => ({ label: programRunStatusMeta[item].label, value: item }))
    : programRegistrationStatuses.map((item) => ({ label: programRegistrationStatusMeta[item].label, value: item }))
  return <FilterSelect className="w-44" label="Статус" onValueChange={onChange} options={[{ label: "Все статусы", value: "all" }, ...options]} value={value} />
}

function MobileFilters(props: ProgramsControlsProps) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Button aria-label="Фильтры программ" onClick={() => setOpen(true)} size="sm" variant="outline">
        <IconFilter aria-hidden="true" />
        {props.activeFilters ? <Badge variant="secondary">{props.activeFilters}</Badge> : null}
      </Button>
      <SheetContent className="w-full" side="bottom">
        <SheetHeader>
          <SheetTitle>Фильтры программ</SheetTitle>
          <SheetDescription>Категория и статус сохраняются в URL.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 sm:grid-cols-2">
          <CategorySelect categories={props.categories} onChange={props.onCategoryChange} value={props.category} />
          {props.section !== "templates" ? <StatusSelect onChange={props.onStatusChange} section={props.section} value={props.status} /> : null}
          {props.section === "runs" && props.view === "scheduler" ? (
            <FilterSelect label="Период scheduler" onValueChange={(next) => props.onPeriodChange(next as ProgramPeriod)} options={[{ label: "3 дня", value: "3days" }, { label: "Неделя", value: "week" }]} value={props.period} />
          ) : null}
        </div>
        <SheetFooter>
          <Button onClick={() => setOpen(false)}><IconAdjustmentsHorizontal aria-hidden="true" />Готово</Button>
          {props.activeFilters ? <Button onClick={() => { props.onReset(); setOpen(false) }} variant="outline">Сбросить</Button> : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
