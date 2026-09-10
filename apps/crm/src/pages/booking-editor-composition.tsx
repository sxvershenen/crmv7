import { useEffect, useRef, useState } from "react"
import { bookingPriceKey } from "@app/lib/booking-pricing"
import {
  IconCopy,
  IconPlus,
  IconReceipt,
  IconRotateClockwise,
  IconTrash,
} from "@tabler/icons-react"
import {
  Button,
  DateTimeRangePicker,
  EditorSection,
  FormField,
  FormSelect,
  Input,
  PageState,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crm/ui"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"
import { useDirectoryResources } from "@app/features/use-directory-data"
import type {
  BookingCategory,
  BookingEditorAddOn,
  BookingEditorPosition,
  BookingEditorRecord,
} from "@app/entities/bookings"
import {
  categoryOptions,
  inputNumber,
  isStayCategory,
  isUuid,
  money,
  type ResourceStayQuoteGateway,
} from "./booking-editor-model.js"

export function BookingComposition({
  autoPrice,
  draft,
  onAdd,
  onDelete,
  onDuplicate,
  onResourceChange,
  pricingGateway,
  updatePosition,
}: {
  autoPrice: boolean;
  draft: BookingEditorRecord;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (position: BookingEditorPosition) => void;
  onResourceChange: (id: string, resourceId: string) => void;
  pricingGateway: ResourceStayQuoteGateway;
  updatePosition: <K extends keyof BookingEditorPosition>(
    id: string,
    key: K,
    value: BookingEditorPosition[K],
  ) => void;
}) {
  const resources = useDirectoryResources();
  const resourceOptions = resources.map((resource) => ({ value: resource.id, label: resource.name }));
  const [quoteState, setQuoteState] = useState<Record<string, "loading" | "ready" | "error">>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [catalogs, setCatalogs] = useState<Record<string, { assignmentId: string; addOnOfferingId: string; label: string; serviceType: "quantity_service" | "person_service"; available: boolean; requestOnly: boolean; blocker?: string }[]>>({});
  const quotedInputs = useRef(new Map<string, string>());
  const dirtyAddOnPositions = useRef(new Set<string>());
  const catalogTargetsKey = JSON.stringify(draft.positions
    .filter((position) => isStayCategory(position.category) && isUuid(position.resourceId))
    .map(({ id, resourceId }) => ({ id, resourceId })));

  useEffect(() => {
    let active = true;
    const catalogTargets = JSON.parse(catalogTargetsKey) as Array<{ id: string; resourceId: string }>;
    for (const position of catalogTargets) {
      setCatalogs((current) => ({ ...current, [position.id]: [] }));
      void houseOfferingGateway.resolvePrimaryStayOffering(position.resourceId).then(async (resolved) => {
        if (resolved.resolution !== "linked") return;
        const editor = resolved.offering.kind === "house" ? await houseOfferingGateway.getHouseEditor(resolved.offering.offeringId) : await houseOfferingGateway.getCampgroundEditor(resolved.offering.offeringId);
        if (!active || !editor) return;
        const next = editor.addOnAssignments.filter((assignment) => assignment.enabled).map((assignment) => {
          const item = editor.addOnCatalog.find((candidate) => candidate.offering.id === assignment.addOnOfferingId);
          const blocker = item?.availability.blocker === "active_price_book_missing" ? "Нет цены" : item?.availability.blocker === "archived" ? "В архиве" : item?.availability.blocker === "not_active" ? "Не активен" : undefined;
          const serviceType: "quantity_service" | "person_service" = item?.serviceType === "person_service" ? "person_service" : "quantity_service";
          const requestOnly = item?.offering.salesMode === "request_only";
          const supported = item?.serviceType === "quantity_service" || item?.serviceType === "person_service";
          return { assignmentId: assignment.id, addOnOfferingId: assignment.addOnOfferingId, label: assignment.labelOverride ?? item?.offering.operationalName ?? "Дополнительная услуга", serviceType, requestOnly, available: supported && !requestOnly && item?.availability.status !== "blocked", ...(!supported ? { blocker: "Нужен выбор времени" } : blocker ? { blocker } : {}) };
        });
        setCatalogs((current) => ({ ...current, [position.id]: next }));
      }).catch(() => { if (active) setCatalogs((current) => ({ ...current, [position.id]: [] })); });
    }
    return () => { active = false; };
  }, [catalogTargetsKey]);

  useEffect(() => {
    let active = true;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const pendingInputs = new Map<string, string>();
    const cachedInputs = quotedInputs.current;
    for (const position of draft.positions) {
      if (!isStayCategory(position.category) || !isUuid(position.resourceId)) continue;
      if (!autoPrice && !position.addOns?.length && position.calculatedInputKey == null && !dirtyAddOnPositions.current.has(position.id)) continue;
      const arrivalDate = position.startAt.slice(0, 10);
      const departureDate = position.endAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || arrivalDate >= departureDate || position.guestCount < 1) continue;
      const inputKey = bookingPriceKey(position);
      if (position.calculatedInputKey === inputKey) continue;
      if (quotedInputs.current.get(position.id) === inputKey) continue;
      setQuoteState((current) => ({ ...current, [position.id]: "loading" }));
      timers.push(setTimeout(() => {
        quotedInputs.current.set(position.id, inputKey);
        pendingInputs.set(position.id, inputKey);
        const input = {
          arrivalDate,
          currency: "RUB" as const,
          departureDate,
          idempotencyKey: `booking-quote-${crypto.randomUUID()}`,
          operationId: crypto.randomUUID(),
          quantity: position.guestCount,
          addOns: (position.addOns ?? []).map(({ assignmentId, quantity }) => ({ assignmentId, quantity })),
        };
        void pricingGateway.previewResourceStayQuote(position.resourceId, input).then((quote) => {
          if (!active || quotedInputs.current.get(position.id) !== inputKey) return;
          pendingInputs.delete(position.id);
          setQuoteState((current) => ({ ...current, [position.id]: "ready" }));
          dirtyAddOnPositions.current.delete(position.id);
          updatePosition(position.id, "basePrice", quote.total.amountMinor / 100);
          updatePosition(position.id, "quoteSnapshotId", (position.addOns ?? []).length ? quote.quoteId : null);
          const prices = new Map((quote.lines ?? []).filter((line) => line.kind === "addon" && line.addOnAssignmentId).map((line) => [line.addOnAssignmentId!, line.amount.amountMinor / 100]));
          updatePosition(position.id, "addOns", (position.addOns ?? []).map((addon) => ({ ...addon, price: prices.get(addon.assignmentId) ?? addon.price })));
          updatePosition(position.id, "calculatedInputKey", inputKey);
        }).catch((reason: unknown) => {
          if (!active || quotedInputs.current.get(position.id) !== inputKey) return;
          pendingInputs.delete(position.id);
          setQuoteState((current) => ({ ...current, [position.id]: "error" }));
          setQuoteErrors((current) => ({ ...current, [position.id]: reason instanceof Error ? reason.message : "Сервис расчёта недоступен" }));
        });
      }, 250));
    }
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      // A changed position can cancel an in-flight request. Do not cache an
      // input whose result was discarded, or the retry will stay loading.
      for (const [positionId, inputKey] of pendingInputs) {
        if (cachedInputs.get(positionId) === inputKey) cachedInputs.delete(positionId);
      }
    };
  }, [autoPrice, draft.positions, pricingGateway, quoteRetry, updatePosition]);

  return (
    <div className="min-w-0 space-y-3" data-slot="booking-composition">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Состав <span className="ml-1 text-muted-foreground">{draft.positions.length}</span></h2>
        <Button className="min-h-11 sm:min-h-8" onClick={onAdd} size="sm">
          <IconPlus aria-hidden="true" />
          Добавить позицию
        </Button>
      </div>
      {draft.positions.length ? (
        <div className="min-w-0 space-y-3">
          {draft.positions.map((position, index) => (
            <EditorSection className="min-w-0" key={position.id} title={`Позиция ${index + 1}`} actions={
                <div className="flex items-center gap-1">
                  <PositionAction
                    icon={IconCopy}
                    label={`Дублировать позицию ${index + 1}`}
                    onClick={() => onDuplicate(position)}
                  />
                  <PositionAction
                    icon={IconTrash}
                    label={`Удалить позицию ${index + 1}`}
                    onClick={() => onDelete(position.id)}
                  />
                </div>
              }>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] items-start gap-3 sm:grid-cols-6 [&_button]:min-h-11 [&_input]:min-h-11 sm:[&_button]:min-h-9 sm:[&_input]:min-h-9">
                <FormField
                  className="col-span-2 min-w-0 sm:col-span-2"
                  htmlFor={`${position.id}-type`}
                  label="Тип позиции"
                >
                  <FormSelect
                    className="min-w-0 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                    id={`${position.id}-type`}
                    label={`Тип позиции ${index + 1}`}
                    onValueChange={(value) =>
                      updatePosition(
                        position.id,
                        "category",
                        value as Exclude<BookingCategory, "all">,
                      )
                    }
                    options={categoryOptions}
                    value={position.category}
                  />
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-3"
                  htmlFor={`${position.id}-resource`}
                  label="Ресурс"
                >
                  <FormSelect
                    className="min-w-0 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                    id={`${position.id}-resource`}
                    label={`Ресурс позиции ${index + 1}`}
                    onValueChange={(value) =>
                      onResourceChange(position.id, value)
                    }
                    options={resourceOptions.filter(
                      (option) =>
                        resources.find(
                          (resource) => resource.id === option.value,
                        )?.category === position.category,
                    )}
                    value={position.resourceId}
                  />
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-1"
                  htmlFor={`${position.id}-guests`}
                  label="Гостей"
                >
                  <Input
                    id={`${position.id}-guests`}
                    min="1"
                    onChange={(event) =>
                      updatePosition(
                        position.id,
                        "guestCount",
                        inputNumber(event.target.value),
                      )
                    }
                    type="number"
                    value={position.guestCount}
                  />
                </FormField>
                <FormField className="col-span-2 min-w-0 sm:col-span-4" htmlFor={`${position.id}-period`} label="Период">
                  <DateTimeRangePicker id={`${position.id}-period`} label={`Период позиции ${index + 1}`} onValueChange={(value) => {
                    updatePosition(position.id, "startAt", value.from);
                    updatePosition(position.id, "endAt", value.to);
                  }} value={{ from: position.startAt, to: position.endAt }} />
                </FormField>
              </div>
              {isStayCategory(position.category) && catalogs[position.id]?.length ? <BookingAddOns position={position} options={catalogs[position.id]!} onChange={(addOns) => { dirtyAddOnPositions.current.add(position.id); updatePosition(position.id, "addOns", addOns); updatePosition(position.id, "quoteSnapshotId", null); }} /> : null}
              <div className="mt-3 grid min-w-0 grid-cols-2 items-start gap-3 border-t pt-3 sm:grid-cols-6 [&_input]:min-h-11 sm:[&_input]:min-h-9">
                <FormField
                  className="min-w-0 sm:col-span-3"
                  htmlFor={`${position.id}-base`}
                  label="Стоимость, ₽"
                >
                  <div><Input
                      id={`${position.id}-base`}
                      min="0"
                      onChange={(event) =>
                        updatePosition(
                          position.id,
                          "basePrice",
                          inputNumber(event.target.value),
                        )
                      }
                      readOnly={isStayCategory(position.category) && (autoPrice || Boolean(position.addOns?.length))}
                      type="number"
                      value={position.basePrice}
                    />{(autoPrice || Boolean(position.addOns?.length) || dirtyAddOnPositions.current.has(position.id)) && isStayCategory(position.category) ? <div aria-live="polite" className={`mt-1 text-[11px] ${quoteState[position.id] === "error" ? "text-danger-foreground" : "text-muted-foreground"}`}>
                      {quoteState[position.id] === "loading" ? "Рассчитываем по датам…" : quoteState[position.id] === "ready" ? "Рассчитано по ценам ресурса" : quoteState[position.id] === "error" ? <><p className="break-words">Не удалось рассчитать: {quoteErrors[position.id]}</p><Button aria-label={`Повторить расчёт позиции ${index + 1}`} className="mt-1 min-h-11 sm:min-h-8" onClick={() => { quotedInputs.current.delete(position.id); setQuoteRetry((current) => current + 1); }} size="sm" variant="outline"><IconRotateClockwise aria-hidden="true" />Повторить расчёт</Button></> : "Укажите даты заезда и выезда"}
                    </div> : null}{position.addOns?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Допуслуги включены в стоимость</p> : null}</div>
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-1"
                  htmlFor={`${position.id}-discount`}
                  label="Скидка, %"
                >
                  <Input
                    aria-describedby={position.addOns?.length ? `${position.id}-discount-help` : undefined}
                    disabled={Boolean(position.addOns?.length)}
                    id={`${position.id}-discount`}
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updatePosition(
                        position.id,
                        "discount",
                        inputNumber(event.target.value),
                      )
                    }
                    type="number"
                    value={position.discount}
                  />
                </FormField>
                <FormField
                  className="col-span-2 min-w-0 sm:col-span-2"
                  htmlFor={`${position.id}-total`}
                  label="Итого"
                >
                  <output
                    aria-label={`Итого позиции ${index + 1}`}
                    className="flex min-h-11 items-center text-lg font-semibold tabular-nums sm:min-h-9"
                    id={`${position.id}-total`}
                  >{money.format(position.total)}</output>
                </FormField>
              </div>
              {position.addOns?.length ? <div className="mt-2 text-[11px] text-muted-foreground" id={`${position.id}-discount-help`}>
                {position.discount !== 0 ? <><p role="alert" className="text-danger-foreground">Сохранение недоступно: для позиции с допуслугами скидка должна быть 0%. Уберите скидку или допуслуги.</p><Button className="mt-1 min-h-11 sm:min-h-8" onClick={() => updatePosition(position.id, "discount", 0)} size="sm" variant="outline">Убрать скидку</Button></> : "Ручная скидка недоступна для позиции с допуслугами."}
              </div> : null}
            </EditorSection>
          ))}
        </div>
      ) : (
        <PageState
          actionLabel="Добавить позицию"
          icon={IconReceipt}
          onAction={onAdd}
          title="Состав пока пуст"
        >
          Добавьте ресурс, время, количество гостей и цену.
        </PageState>
      )}
    </div>
  );
}

function BookingAddOns({ position, options, onChange }: { position: BookingEditorPosition; options: { assignmentId: string; addOnOfferingId: string; label: string; serviceType: "quantity_service" | "person_service"; available: boolean; requestOnly: boolean; blocker?: string }[]; onChange: (value: BookingEditorAddOn[]) => void }) {
  const selected = position.addOns ?? [];
  return <div className="mt-3 min-w-0 border-t pt-3" data-slot="booking-addons">
    <p className="mb-2 text-xs font-medium">Дополнительные услуги</p>
    <div className="divide-y">
      {options.map((option) => {
        const current = selected.find((item) => item.assignmentId === option.assignmentId);
        return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" key={option.assignmentId}>
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span>
          <Button className="min-h-11 sm:order-last sm:min-h-8" disabled={!current && !option.available} onClick={() => onChange(current ? selected.filter((item) => item.assignmentId !== option.assignmentId) : [...selected, { assignmentId: option.assignmentId, addOnOfferingId: option.addOnOfferingId, label: option.label, serviceType: option.serviceType, quantity: 1, price: 0 }])} size="sm" variant={current ? "secondary" : "outline"}>{current ? "Убрать" : "Добавить"}</Button>
          {current ? <Input aria-label={`Количество ${option.label}`} className="min-h-11 w-20 sm:min-h-8" min="1" onChange={(event) => onChange(selected.map((item) => item.assignmentId === option.assignmentId ? { ...item, quantity: Math.max(1, inputNumber(event.target.value)) } : item))} type="number" value={current.quantity} /> : <span className="hidden sm:block" />}
          <span className="min-w-0 text-right text-[11px] tabular-nums text-muted-foreground">{option.requestOnly ? "По запросу" : option.blocker ?? (current ? money.format(current.price) : "")}</span>
        </div>;
      })}
    </div>
  </div>;
}
function PositionAction({
  icon: Icon,
  label,
  onClick,
}: {
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
            className="size-11 sm:size-8"
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

