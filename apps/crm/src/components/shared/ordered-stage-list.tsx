import { useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconGripVertical,
  IconTrash,
} from "@tabler/icons-react";

import {
  Button,
  FormField,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crm/ui";

export type OrderedStageItem = {
  id: string;
  name: string;
  durationMinutes: number;
  comment: string;
};

type Props<T extends OrderedStageItem> = {
  itemLabel?: string;
  onChange: <K extends keyof T>(id: string, key: K, value: T[K]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (stage: T) => void;
  onMove: (from: number, to: number) => void;
  stages: T[];
  testId?: string;
};

export function OrderedStageList<T extends OrderedStageItem>({
  itemLabel = "Этап",
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  stages,
  testId = "ordered-stage-list",
}: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeStage = stages.find((stage) => stage.id === activeId) ?? null;
  const handleEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const from = stages.findIndex((stage) => stage.id === event.active.id);
    const to = stages.findIndex((stage) => stage.id === event.over?.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleEnd}
      onDragStart={(event: DragStartEvent) =>
        setActiveId(String(event.active.id))
      }
      sensors={sensors}
    >
      <div className="divide-y rounded-lg border" data-testid={testId}>
        {stages.map((stage, index) => (
          <StageRow
            index={index}
            itemLabel={itemLabel}
            key={stage.id}
            onChange={onChange}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMove={onMove}
            stage={stage}
            stages={stages}
            total={stages.length}
          />
        ))}
      </div>
      <DragOverlay>
        {activeStage ? (
          <div className="w-72 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
            <p className="truncate font-medium">{activeStage.name}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {activeStage.durationMinutes} мин
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageRow<T extends OrderedStageItem>({
  index,
  itemLabel = "Этап",
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  stage,
  total,
}: Props<T> & { index: number; stage: T; total: number }) {
  const draggable = useDraggable({ id: stage.id });
  const droppable = useDroppable({ id: stage.id });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const lowerLabel = itemLabel.toLocaleLowerCase("ru-RU");

  return (
    <article
      className={
        draggable.isDragging
          ? "relative z-20 bg-muted/30 opacity-35"
          : "relative bg-background"
      }
      data-stage-id={stage.id}
      data-stage-index={index}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between gap-3 border-b border-dashed px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={`Перетащить ${lowerLabel} ${index + 1}`}
                  className="touch-none"
                  ref={draggable.setActivatorNodeRef}
                  size="icon-sm"
                  variant="ghost"
                  {...draggable.attributes}
                  {...draggable.listeners}
                />
              }
            >
              <IconGripVertical aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Перетащить {lowerLabel}</TooltipContent>
          </Tooltip>
          <p className="truncate text-xs font-medium">
            {itemLabel} {index + 1}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <StageAction
            disabled={index === 0}
            icon={IconArrowUp}
            label={`Поднять ${lowerLabel} ${index + 1}`}
            onClick={() => onMove(index, index - 1)}
          />
          <StageAction
            disabled={index === total - 1}
            icon={IconArrowDown}
            label={`Опустить ${lowerLabel} ${index + 1}`}
            onClick={() => onMove(index, index + 1)}
          />
          <StageAction
            icon={IconCopy}
            label={`Дублировать ${lowerLabel} ${index + 1}`}
            onClick={() => onDuplicate(stage)}
          />
          <StageAction
            icon={IconTrash}
            label={`Удалить ${lowerLabel} ${index + 1}`}
            onClick={() => onDelete(stage.id)}
          />
        </div>
      </div>
      <div className="grid items-start gap-3 p-3 sm:grid-cols-6">
        <FormField
          className="sm:col-span-5"
          htmlFor={`${stage.id}-name`}
          label={`Название ${lowerLabel}а ${index + 1}`}
        >
          <Input
            id={`${stage.id}-name`}
            onChange={(event) =>
              onChange(stage.id, "name", event.target.value as T["name"])
            }
            value={stage.name}
          />
        </FormField>
        <FormField
          className="sm:col-span-1"
          htmlFor={`${stage.id}-duration`}
          label={`Минут, ${lowerLabel} ${index + 1}`}
        >
          <Input
            id={`${stage.id}-duration`}
            min="0"
            onChange={(event) =>
              onChange(
                stage.id,
                "durationMinutes",
                (Number(event.target.value) || 0) as T["durationMinutes"],
              )
            }
            type="number"
            value={stage.durationMinutes}
          />
        </FormField>
        <FormField
          className="sm:col-span-6"
          htmlFor={`${stage.id}-comment`}
          label={`Комментарий ${lowerLabel}а ${index + 1}`}
        >
          <Textarea
            id={`${stage.id}-comment`}
            onChange={(event) =>
              onChange(stage.id, "comment", event.target.value as T["comment"])
            }
            placeholder="Необязательно"
            rows={3}
            value={stage.comment}
          />
        </FormField>
      </div>
    </article>
  );
}

function StageAction({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
