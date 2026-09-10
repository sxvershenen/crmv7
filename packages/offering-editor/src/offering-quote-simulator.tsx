import { useEffect, useRef, useState } from "react"
import { IconCalendarCheck, IconCircleCheck, IconClock, IconReceipt2, IconUsers } from "@tabler/icons-react"

import type { InternalOfferingEditor, InternalOfferingQuoteResult, InternalStayOfferingQuoteBody } from "@crm/contracts"
import { Button, EditorSection, FormField, Input, Separator, StatusBadge } from "@crm/ui"

import {
  offeringEditorErrorMessage,
  type OfferingEditorCommandMetaFactory,
  type OfferingEditorGateway,
} from "./gateway.js"
import {
  buildCampgroundQuoteBody,
  buildHouseQuoteBody,
  HouseQuoteRequestCache,
  incrementDateOnly,
  serviceDateInTimezone,
} from "./house-offering-helpers.js"
import {
  compactDate,
  compactDateTime,
  minorMoney,
  numberOrZero,
  priceBookSource,
} from "./house-offering-workspace-model.js"

export function QuoteSimulator({ compact = false, createCommandMeta, editor, gateway, kind }: { compact?: boolean; createCommandMeta: OfferingEditorCommandMetaFactory; editor: InternalOfferingEditor; gateway: OfferingEditorGateway; kind: "house" | "campground" }) {
  const defaultPlan = priceBookSource(editor)?.ratePlans.find((plan) => plan.isDefault)?.key ?? null
  const campground = kind === "campground" && editor.offering.fulfillment.kind === "campground" ? editor.offering.fulfillment : null
  const quantityLabel = campground?.salesUnit === "own_tent_pitch" ? "Палаточных мест" : "Гости"
  const [arrivalDate, setArrivalDate] = useState(() => serviceDateInTimezone(editor.offering.timezone))
  const [departureDate, setDepartureDate] = useState(() => incrementDateOnly(serviceDateInTimezone(editor.offering.timezone)))
  const [quantity, setQuantity] = useState(campground?.salesUnit === "own_tent_pitch" ? "1" : "2")
  const [quote, setQuote] = useState<InternalOfferingQuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const requestRef = useRef(new HouseQuoteRequestCache<InternalStayOfferingQuoteBody>())
  const inputKey = JSON.stringify({ arrivalDate, defaultPlan, departureDate, quantity, salesUnit: campground?.salesUnit ?? "house", timezone: editor.offering.timezone, currency: editor.offering.currency })

  useEffect(() => {
    requestRef.current.reset()
    setQuote(null)
    setError(null)
  }, [inputKey])

  const preview = async () => {
    setError(null)
    setRunning(true)
    try {
      const request = requestRef.current.getOrCreate(inputKey, () => campground
        ? buildCampgroundQuoteBody({ arrivalDate, currency: editor.offering.currency, departureDate, meta: createCommandMeta(), quantity: numberOrZero(quantity), ratePlanKey: defaultPlan, salesUnit: campground.salesUnit })
        : buildHouseQuoteBody({ arrivalDate, currency: editor.offering.currency, departureDate, guests: numberOrZero(quantity), meta: createCommandMeta(), ratePlanKey: defaultPlan }))
      const result = campground
        ? await gateway.previewCampgroundQuote(editor.offering.id, request as ReturnType<typeof buildCampgroundQuoteBody>)
        : await gateway.previewHouseQuote(editor.offering.id, request as ReturnType<typeof buildHouseQuoteBody>)
      setQuote(result)
      requestRef.current.markSuccess(inputKey)
    } catch (quoteError) {
      setError(offeringEditorErrorMessage(quoteError, "Не удалось рассчитать стоимость."))
    } finally { setRunning(false) }
  }
  if (compact) return <EditorSection subtitle="Проверьте итог для конкретных дат и гостей." title="Проверить стоимость">
    <div className="grid items-end gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(135px,1fr)_minmax(135px,1fr)_minmax(90px,110px)_auto]" data-slot="resource-quote-form">
      <FormField className="min-w-0" htmlFor="quote-arrival" label="Заезд"><Input id="quote-arrival" onChange={(event) => setArrivalDate(event.target.value)} type="date" value={arrivalDate} /></FormField>
      <FormField className="min-w-0" htmlFor="quote-departure" label="Выезд"><Input id="quote-departure" onChange={(event) => setDepartureDate(event.target.value)} type="date" value={departureDate} /></FormField>
      <FormField className="min-w-0" htmlFor="quote-quantity" label={quantityLabel}><Input id="quote-quantity" min="1" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></FormField>
      <Button className="w-full sm:self-end" disabled={!editor.capabilities.canPreviewQuote || running} onClick={() => void preview()}><IconReceipt2 aria-hidden="true" />{running ? "Считаем…" : "Рассчитать"}</Button>
    </div>
    {!editor.capabilities.canPreviewQuote ? <p className="mt-3 text-xs text-muted-foreground">Расчёт станет доступен, когда цены начнут действовать.</p> : null}
    {error ? <div className="mt-3 rounded-lg border border-danger/20 p-3 text-xs text-danger-foreground" role="alert">{error}</div> : null}
    <div className="mt-3">{quote ? <QuoteResult compact quote={quote} timezone={editor.offering.timezone} /> : <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-muted/15 p-4 text-center"><div><IconReceipt2 aria-hidden="true" className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Расчёт появится здесь</p></div></div>}</div>
  </EditorSection>

  return <EditorSection subtitle="Расчёт не создаёт бронь и сохраняется как неизменяемый снимок условий." title="Проверить стоимость">
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-2">
          <FormField htmlFor="quote-arrival" label="Заезд"><Input id="quote-arrival" onChange={(event) => setArrivalDate(event.target.value)} type="date" value={arrivalDate} /></FormField>
          <FormField htmlFor="quote-departure" label="Выезд"><Input id="quote-departure" onChange={(event) => setDepartureDate(event.target.value)} type="date" value={departureDate} /></FormField>
        </div>
        <FormField className="max-w-36" htmlFor="quote-quantity" label={quantityLabel}><Input id="quote-quantity" min="1" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></FormField>
        <Button className="w-full" disabled={!editor.capabilities.canPreviewQuote || running} onClick={() => void preview()}><IconReceipt2 aria-hidden="true" />{running ? "Считаем…" : "Рассчитать"}</Button>
        {!editor.capabilities.canPreviewQuote ? <p className="text-xs text-muted-foreground">Расчёт станет доступен после привязки ресурса и активного прайс-листа.</p> : null}
        {error ? <div className="rounded-lg border border-danger/20 p-3 text-xs text-danger-foreground" role="alert">{error}</div> : null}
      </div>
      <Separator className="hidden lg:block" orientation="vertical" />
      {quote ? <QuoteResult quote={quote} timezone={editor.offering.timezone} /> : <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-muted/15 p-6 text-center"><div><IconReceipt2 aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Здесь появится расчёт</p><p className="mt-1 text-[11px] text-muted-foreground">Укажите даты и {quantityLabel.toLocaleLowerCase("ru-RU")}.</p></div></div>}
    </div>
  </EditorSection>
}

function QuoteResult({ compact = false, quote, timezone }: { compact?: boolean; quote: InternalOfferingQuoteResult; timezone: string }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border bg-background">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
      <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Итого</p><p className="mt-1 text-2xl font-semibold tabular-nums">{minorMoney(quote.total.amountMinor, quote.currency)}</p></div>
      <StatusBadge tone="success"><IconCircleCheck aria-hidden="true" />{compact ? "Рассчитано" : "Снимок зафиксирован"}</StatusBadge>
      <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><IconCalendarCheck aria-hidden="true" className="size-3" />Действителен до {compactDateTime(quote.validUntil, timezone)}</span><span className="flex items-center gap-1"><IconClock aria-hidden="true" className="size-3" />Рассчитан {compactDateTime(quote.calculatedAt, timezone)}</span></div>
    </div>
    <div className="divide-y px-4">{quote.lines.map((line, index) => <div className="py-3 text-xs" key={`${line.kind}-${index}`}><div className="flex flex-col justify-between gap-1 min-[420px]:flex-row min-[420px]:gap-3"><div className="min-w-0"><p className="font-medium">{line.serviceDate ? compactDate(line.serviceDate) : line.label}</p>{!compact && line.serviceDate ? <p className="mt-0.5 text-[10px] text-muted-foreground">{compactDate(line.serviceDate)}</p> : null}</div><span className="shrink-0 font-semibold tabular-nums">{minorMoney(line.amount.amountMinor, quote.currency)}</span></div>{!compact ? <><p className="mt-1 text-[10px] text-muted-foreground">{line.explanation}</p>{line.matchedRuleId ? <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/75">Правило: {line.matchedRuleId}</p> : null}</> : null}</div>)}</div>
    {!compact ? <div className="border-t bg-muted/20 px-4 py-2.5 text-[9px] leading-4 text-muted-foreground"><p className="flex items-center gap-1 font-medium"><IconUsers aria-hidden="true" className="size-3" />Версии источников расчёта</p><p className="mt-1 break-all font-mono">Прайс-лист {quote.provenance.priceBookId} · v{quote.provenance.priceBookVersion}; календарь {quote.provenance.businessCalendarId} · v{quote.provenance.businessCalendarVersion}</p></div> : null}
  </div>
}
