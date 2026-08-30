import { IconFilter } from "@tabler/icons-react"

import { Badge, Button, FilterSelect, SettingsBar, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@crm/ui"

import type { TaskOrder, TaskPriority, TaskRelationType } from "@app/entities/tasks"
import { taskOrderLabels, taskOrders, taskPriorities, taskPriorityMeta, taskRelationLabels, taskRelationTypes } from "@app/entities/tasks"

const assigneeOptions = [
  { value: "all", label: "Все исполнители" },
  { value: "mine", label: "Мои задачи" },
  { value: "unassigned", label: "Без исполнителя" },
]
const orderOptions = taskOrders.map((value) => ({ value, label: taskOrderLabels[value] }))
const priorityOptions = [{ value: "all", label: "Любой приоритет" }, ...taskPriorities.map((value) => ({ value, label: taskPriorityMeta[value].label }))]
const relationOptions = [{ value: "all", label: "Все связи" }, ...taskRelationTypes.map((value) => ({ value, label: taskRelationLabels[value] }))]

export function TaskControls({
  activeFilters,
  assignee,
  onChange,
  onReset,
  order,
  priority,
  relation,
}: {
  activeFilters: number
  assignee: "all" | "mine" | "unassigned"
  onChange: (name: "assignee" | "orderBy" | "priority" | "relation", value: string, fallback?: string) => void
  onReset: () => void
  order: TaskOrder
  priority: TaskPriority | "all"
  relation: TaskRelationType | "all"
}) {
  const secondary = <>
    <FilterSelect label="Приоритет задач" onValueChange={(value) => onChange("priority", value)} options={priorityOptions} value={priority} />
    <FilterSelect label="Тип связи" onValueChange={(value) => onChange("relation", value)} options={relationOptions} value={relation} />
    {activeFilters > 0 ? <Button onClick={onReset} size="xs" variant="ghost">Сбросить · {activeFilters}</Button> : null}
  </>

  return (
    <SettingsBar
      filters={secondary}
      mobileActions={<TaskMobileFilters activeFilters={activeFilters} onChange={onChange} onReset={onReset} order={order} priority={priority} relation={relation} />}
      mobilePrimary={<FilterSelect className="min-w-32" label="Исполнитель задач" onValueChange={(value) => onChange("assignee", value)} options={assigneeOptions} value={assignee} />}
      primary={<>
        <FilterSelect className="min-w-32" label="Исполнитель задач" onValueChange={(value) => onChange("assignee", value)} options={assigneeOptions} value={assignee} />
        <FilterSelect className="min-w-40" label="Порядок задач" onValueChange={(value) => onChange("orderBy", value, "dueAsc")} options={orderOptions} value={order} />
      </>}
    />
  )
}

function TaskMobileFilters({ activeFilters, onChange, onReset, order, priority, relation }: Omit<Parameters<typeof TaskControls>[0], "assignee">) {
  return (
    <Sheet>
      <SheetTrigger render={<Button aria-label="Фильтры задач" size="sm" variant="outline" />}><IconFilter aria-hidden="true" />{activeFilters > 0 ? <Badge className="min-w-5 justify-center" variant="secondary">{activeFilters}</Badge> : null}</SheetTrigger>
      <SheetContent className="w-full" side="bottom">
        <SheetHeader><SheetTitle>Фильтры задач</SheetTitle><SheetDescription>Порядок, приоритет и связанный процесс.</SheetDescription></SheetHeader>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          <FilterSelect className="max-w-none" label="Порядок задач" onValueChange={(value) => onChange("orderBy", value, "dueAsc")} options={orderOptions} value={order} />
          <FilterSelect className="max-w-none" label="Приоритет задач" onValueChange={(value) => onChange("priority", value)} options={priorityOptions} value={priority} />
          <FilterSelect className="max-w-none" label="Тип связи" onValueChange={(value) => onChange("relation", value)} options={relationOptions} value={relation} />
          {activeFilters > 0 ? <Button onClick={onReset} size="sm" variant="outline">Сбросить фильтры</Button> : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
