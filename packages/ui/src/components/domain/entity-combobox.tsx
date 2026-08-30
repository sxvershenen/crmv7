import { useState } from "react";
import { IconChevronDown, IconExternalLink } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EntityComboboxOption = {
  label: string;
  secondary?: string;
  value: string;
};

export function EntityCombobox({
  className,
  emptyLabel = "Ничего не найдено",
  label,
  onOpenSelected,
  onValueChange,
  options,
  placeholder = "Выберите запись",
  searchPlaceholder = "Быстрый поиск…",
  value,
}: {
  className?: string;
  emptyLabel?: string;
  label: string;
  onOpenSelected?: () => void;
  onValueChange: (value: string) => void;
  options: EntityComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div
      className={cn("flex min-w-0 gap-1.5", className)}
      data-slot="entity-combobox"
    >
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <Button
              aria-expanded={open}
              aria-label={label}
              className="min-w-0 flex-1 justify-between px-2.5 font-normal"
              role="combobox"
              variant="outline"
            />
          }
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
          </span>
          <IconChevronDown
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--anchor-width)] min-w-64 p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    data-checked={option.value === value}
                    key={option.value}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    value={`${option.label} ${option.secondary ?? ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{option.label}</span>
                      {option.secondary ? (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {option.secondary}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {onOpenSelected && selected ? (
        <Button
          aria-label={`Открыть: ${selected.label}`}
          onClick={onOpenSelected}
          size="icon"
          variant="outline"
        >
          <IconExternalLink aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
