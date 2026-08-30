import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconExternalLink,
  IconLinkPlus,
  IconUnlink,
} from "@tabler/icons-react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@crm/ui";

export type ManualRelationOption = {
  group?: "exact" | "recent" | "similar";
  href: string;
  id: string;
  label: string;
  meta: string;
  phone?: string;
  reasons?: string[];
  risk?: string;
};

const relationGroups = [
  { value: "exact", label: "Точное совпадение" },
  { value: "similar", label: "Похожие" },
  { value: "recent", label: "Недавние" },
] as const;

export function ManualRelationPicker({
  addLabel,
  emptyLabel,
  label,
  multiple = false,
  onOpen,
  onValuesChange,
  options,
  shortcut = false,
  values,
}: {
  addLabel: string;
  emptyLabel: string;
  label: string;
  multiple?: boolean;
  onOpen: (href: string) => void;
  onValuesChange: (values: string[]) => void;
  options: ManualRelationOption[];
  shortcut?: boolean;
  values: string[];
}) {
  const [open, setOpen] = useState(false);
  const selected = values
    .map((value) => options.find((option) => option.id === value))
    .filter((option): option is ManualRelationOption => Boolean(option));
  const selectedIds = new Set(selected.map((option) => option.id));

  useEffect(() => {
    if (!shortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcut]);

  const toggle = (option: ManualRelationOption) => {
    if (multiple) {
      onValuesChange(
        selectedIds.has(option.id)
          ? values.filter((value) => value !== option.id)
          : [...values, option.id],
      );
      return;
    }

    onValuesChange(selectedIds.has(option.id) ? [] : [option.id]);
    setOpen(false);
  };

  return (
    <div className="grid min-w-0 gap-2" data-slot="manual-relation-picker">
      {selected.length ? (
        <div className="grid gap-1.5">
          {selected.map((option) => (
            <div
              className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted/55 py-1 pl-2.5 pr-1"
              key={option.id}
            >
              <button
                className="min-w-0 flex-1 text-left focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onOpen(option.href)}
                type="button"
              >
                <span className="flex items-center gap-1 text-xs">
                  <span className="truncate">{option.label}</span>
                  <IconExternalLink
                    aria-hidden="true"
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {option.meta}
                </span>
              </button>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={`Убрать связь: ${option.label}`}
                      onClick={() =>
                        onValuesChange(
                          values.filter((value) => value !== option.id),
                        )
                      }
                      size="icon-xs"
                      variant="ghost"
                    />
                  }
                >
                  <IconUnlink aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>Убрать связь</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>
      )}

      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              aria-label={label}
              className="w-fit"
              size="xs"
              variant="outline"
            />
          }
        >
          <IconLinkPlus aria-hidden="true" />
          {selected.length ? "Изменить связи" : addLabel}
          {shortcut ? (
            <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
              ⌥L
            </kbd>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(360px,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder="#ID, телефон или имя…" />
            <CommandList>
              <CommandEmpty>Совпадений нет</CommandEmpty>
              {relationGroups.map((group) => {
                const groupOptions = options.filter(
                  (option) => (option.group ?? "recent") === group.value,
                );
                if (!groupOptions.length) return null;
                return <CommandGroup heading={group.label} key={group.value}>
                {groupOptions.map((option) => {
                  const isSelected = selectedIds.has(option.id);
                  const searchablePhone = option.phone?.replace(/\D/g, "") ?? "";
                  return (
                    <CommandItem
                      className="items-start"
                      key={option.id}
                      onSelect={() => toggle(option)}
                      value={`${option.label} #${option.id} ${option.phone ?? ""} ${searchablePhone} ${option.meta}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">{option.label}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {option.meta}
                        </p>
                        {option.reasons?.length ? (
                          <p className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                            {option.reasons.map((reason) => (
                              <span className="rounded bg-muted px-1.5 py-0.5" key={reason}>
                                {reason}
                              </span>
                            ))}
                          </p>
                        ) : null}
                      </div>
                      {option.risk ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                aria-label={`Риск: ${option.risk}`}
                                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                                role="img"
                              />
                            }
                          >
                            <IconAlertTriangle aria-hidden="true" className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="left">{option.risk}</TooltipContent>
                        </Tooltip>
                      ) : null}
                      <IconCheck
                        aria-hidden="true"
                        className={cn("mt-0.5 size-4 shrink-0", !isSelected && "opacity-0")}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>})}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-[10px] leading-4 text-muted-foreground">
        Поиск по #ID, телефону или имени клиента{shortcut ? " · открыть ⌥L" : ""}
      </p>
    </div>
  );
}
