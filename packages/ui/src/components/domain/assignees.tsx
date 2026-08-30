import { IconCheck, IconPlus } from "@tabler/icons-react";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Assignee = {
  id: string;
  initials: string;
  name: string;
  colorClass?: string;
};

export function Assignees({
  assignLabel = "Назначить ответственного",
  className,
  emptyVariant = "label",
  people,
  onAssign,
  size = "default",
}: {
  assignLabel?: string;
  className?: string;
  emptyVariant?: "icon" | "label";
  people: Assignee[];
  onAssign?: () => void;
  size?: "compact" | "default";
}) {
  if (people.length === 0) {
    if (emptyVariant === "icon") {
      return (
        <Button
          aria-label={assignLabel}
          className={cn(
            "size-6 rounded-full border-dashed bg-muted/40 p-0 text-muted-foreground shadow-none hover:border-muted-foreground/50 hover:bg-muted hover:text-foreground disabled:bg-muted/25 disabled:text-muted-foreground/60",
            className,
          )}
          disabled={!onAssign}
          onClick={onAssign}
          size="icon-xs"
          variant="outline"
        >
          <IconPlus aria-hidden="true" className="size-3.5" />
        </Button>
      );
    }

    return (
      <Button
        className={cn(
          "h-7 border-dashed bg-muted/40 px-2 text-[11px] font-normal text-muted-foreground shadow-none hover:border-muted-foreground/50 hover:bg-muted hover:text-foreground disabled:bg-muted/25 disabled:text-muted-foreground/60",
          className,
        )}
        disabled={!onAssign}
        onClick={onAssign}
        size="sm"
        variant="outline"
      >
        + Назначить
      </Button>
    );
  }

  return (
    <AvatarGroup
      aria-label={`Ответственные: ${people.map((person) => person.name).join(", ")}`}
      className={cn("-space-x-1.5 *:data-[slot=avatar]:ring-0", className)}
    >
      {people.slice(0, 3).map((person) => (
        <Avatar
          className={cn(
            "after:hidden",
            size === "compact" ? "size-6" : "size-7",
          )}
          key={person.id}
          title={person.name}
        >
          <AvatarFallback
            className={cn(
              size === "compact" ? "text-[9px]" : "text-[10px]",
              "font-normal",
              person.colorClass,
            )}
          >
            {person.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {people.length > 3 ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <AvatarGroupCount
                aria-label={`Ещё ${people.length - 3} ответственных`}
                className={cn(
                  "cursor-help after:hidden ring-0",
                  size === "compact"
                    ? "size-6 text-[9px]"
                    : "size-7 text-[10px]",
                )}
                role="img"
              />
            }
          >
            +{people.length - 3}
          </TooltipTrigger>
          <TooltipContent className="grid gap-1" side="bottom">
            <span className="text-[10px] opacity-70">Все ответственные</span>
            {people.map((person) => (
              <span key={person.id}>{person.name}</span>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </AvatarGroup>
  );
}

export function AssigneePicker({
  className,
  label = "Изменить исполнителей",
  onPeopleChange,
  onValueChange,
  options,
  people,
}: {
  className?: string;
  label?: string;
  onPeopleChange?: (people: Assignee[]) => void;
  onValueChange: (person: Assignee | null) => void;
  options: Assignee[];
  people: Assignee[];
}) {
  const selectedIds = new Set(people.map((person) => person.id));
  const selectPerson = (person: Assignee) => {
    if (!onPeopleChange) {
      onValueChange(person);
      return;
    }

    onPeopleChange(
      selectedIds.has(person.id)
        ? people.filter((item) => item.id !== person.id)
        : [...people, person],
    );
  };
  const clear = () => {
    onPeopleChange?.([]);
    onValueChange(null);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={label}
            className={cn(
              "h-7 w-auto min-w-0 rounded-full shadow-none",
              people.length
                ? "px-0.5 hover:bg-muted/70"
                : "border-dashed px-2 text-[11px] text-muted-foreground",
              className,
            )}
            size="sm"
            variant={people.length ? "ghost" : "outline"}
          />
        }
      >
        {people.length ? (
          <Assignees people={people} size="compact" />
        ) : (
          <>
            <IconPlus aria-hidden="true" />
            <span>Назначить</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Исполнители</DropdownMenuLabel>
        {options.map((person) => (
          <DropdownMenuItem
            key={person.id}
            onClick={() => selectPerson(person)}
          >
            <Avatar className="size-6">
              <AvatarFallback
                className={cn("text-[9px] font-normal", person.colorClass)}
              >
                {person.initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate">{person.name}</span>
            {selectedIds.has(person.id) ? (
              <IconCheck aria-hidden="true" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={clear}>
          <IconPlus aria-hidden="true" className="rotate-45" />
          Без исполнителей
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
