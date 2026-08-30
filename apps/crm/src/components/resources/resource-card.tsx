import { useId } from "react"
import {
  IconAlertTriangle,
  IconDots,
  IconLock,
  IconLockOpen,
  IconLockPlus,
  IconUser,
} from "@tabler/icons-react"

import {
  ActionableCard,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconBox,
  IconButton,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crm/ui"

import type { Resource } from "@app/entities/resources"
import { formatResourceDate } from "@app/components/resources/resource-date"
import { ResourceIdentityIcon } from "@app/components/resources/resource-presentation"

export function ResourceCard({ onBlock, onOpen, resource }: { onBlock: () => void; onOpen: () => void; resource: Resource }) {
  return (
    <ActionableCard
      actions={<ResourceActions onBlock={onBlock} onOpen={onOpen} resource={resource} />}
      className="h-full min-h-64"
      contentClassName="h-full"
      onOpen={onOpen}
      openLabel={`Открыть ресурс: ${resource.name}`}
    >
      <div className="flex items-start gap-3 pr-[4.5rem]">
        <ResourceIdentityIcon iconKey={resource.iconKey} kind={resource.kind} />
        <div className="min-w-0 pt-0.5">
          <p className="line-clamp-2 text-sm font-medium leading-5">{resource.name}</p>
          <p className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground">{resource.secondaryType}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x border-t pt-3">
        <Metric label="Вместимость">
          <IconUser aria-hidden="true" className="size-3.5" />
          <span>{resource.capacity.mode === "shared" ? `${resource.capacity.occupied} / ${resource.capacity.total}` : resource.capacity.total}</span>
        </Metric>
        <Metric className="pl-3" label="Будущие брони">{resource.futureBookingCount}</Metric>
      </div>

      {resource.capacity.mode === "shared" ? (
        <Progress
          aria-label={`Занято ${resource.capacity.occupied} из ${resource.capacity.total}`}
          className="mt-2 block gap-0 [&_[data-slot=progress-track]]:bg-neutral-300"
          value={resource.capacity.total > 0 ? resource.capacity.occupied / resource.capacity.total * 100 : 0}
        />
      ) : null}

      <dl className="mt-3 space-y-2 border-t pt-3 text-xs font-normal">
        <DateMetric label="Ближайшая бронь" value={formatResourceDate(resource.nextBookingAt)} />
        <DateMetric label="След. свободное" value={formatResourceDate(resource.nextAvailableFrom)} />
      </dl>

      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs font-normal">
        <span className="text-muted-foreground">Активная блокировка</span>
        <span className="inline-flex items-center gap-1.5">
          {resource.hasActiveBlock ? <IconLock aria-hidden="true" className="size-3.5" /> : <IconLockOpen aria-hidden="true" className="size-3.5 text-muted-foreground" />}
          {resource.hasActiveBlock ? "Да" : "Нет"}
        </span>
      </div>

      {resource.warning ? (
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-[10px] font-normal leading-4 text-warning-foreground">
          <IconBox icon={IconAlertTriangle} size="sm" variant="warning" />
          <span className="min-w-0">{resource.warning.message}</span>
        </div>
      ) : null}
    </ActionableCard>
  )
}

function Metric({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] leading-4 text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1 text-xs font-normal tabular-nums">{children}</div>
    </div>
  )
}

function DateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] leading-4 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-xs font-normal tabular-nums">{value}</dd>
    </div>
  )
}

function ResourceActions({ onBlock, onOpen, resource }: { onBlock: () => void; onOpen: () => void; resource: Resource }) {
  const explanationId = useId()

  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <Button aria-describedby={explanationId} aria-label="Установить блокировку" disabled={!resource.permissions.canManageBlocks} onClick={onBlock} size="icon-sm" variant="outline">
            <IconLockPlus aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent id={explanationId}>{resource.permissions.canManageBlocks ? "Добавить блокировку" : "Недостаточно прав"}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger render={<IconButton label={`Действия ресурса: ${resource.name}`} size="icon-sm" variant="outline"><IconDots /></IconButton>} />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>Открыть ресурс</DropdownMenuItem>
          <DropdownMenuItem disabled={!resource.permissions.canEdit} onClick={onOpen}>Настройки ресурса</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
