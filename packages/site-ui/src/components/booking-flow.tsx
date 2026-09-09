import { ArrowRight, Check, CheckCircle2, ChevronLeft, Gift, MessageCircle, Phone, Send, Sparkles, Tag } from "lucide-react"
import { useState, type ReactNode } from "react"

import { cn } from "../lib/cn"
import { BookingSummary, DateRangeCalendar, GuestStepper, type BookingSummaryLine, type DateRange } from "./booking"
import { Dialog } from "./overlays"
import { Button, ButtonGroup, Checkbox, Field, Input, Typography } from "./primitives"

export type BookingContactMethod = "phone" | "vk" | "telegram"

export interface ResourceBookingDraft {
  dates: DateRange
  adults: number
  children: number
  extraIds: string[]
  promoCode: string
  name: string
  phone: string
  contactMethod: BookingContactMethod
  consent: boolean
}

export interface ResourceBookingExtra {
  id: string
  title: string
  description?: string
  priceLabel: ReactNode
  icon?: ReactNode
  unavailable?: boolean
}

export interface ResourceBookingQuote {
  lines: BookingSummaryLine[]
  total?: ReactNode
  note?: ReactNode
  loading?: boolean
  error?: ReactNode
}

export interface ResourceBookingSuccess {
  reference?: ReactNode
  message?: ReactNode
}

export interface ResourceBookingWizardProps {
  resource: { title: ReactNode; description?: ReactNode; image?: string; imageAlt?: string }
  value: ResourceBookingDraft
  onChange: (next: ResourceBookingDraft) => void
  extras: ResourceBookingExtra[]
  quote: ResourceBookingQuote
  unavailable?: (date: Date) => boolean
  minDate?: Date
  month?: Date
  promoStatus?: { tone: "success" | "error" | "neutral"; message: ReactNode }
  onApplyPromo?: (code: string) => void
  onSubmit: (draft: ResourceBookingDraft) => void
  onOpenPrivacy?: () => void
  submitting?: boolean
  success?: ResourceBookingSuccess
  className?: string
}

const steps = [
  { id: 1, label: "Даты и гости", shortLabel: "Даты" },
  { id: 2, label: "Допы и промокод", shortLabel: "Допы" },
  { id: 3, label: "Контакты", shortLabel: "Контакты" },
] as const

function StepIntro({ title, description }: { title: ReactNode; description: ReactNode }) {
  return <div className="site-booking-step__intro"><Typography as="h3" variant="body" className="site-booking-step__title">{title}</Typography><Typography tone="muted" variant="caption">{description}</Typography></div>
}

function QuotePanel({ quote }: { quote: ResourceBookingQuote }) {
  return <aside className="site-booking-quote" aria-label="Предварительный расчёт">
    <div className="site-booking-quote__header"><Typography variant="eyebrow" tone="brand">Предварительно</Typography><Typography variant="caption" tone="muted">Цену и доступность подтвердит менеджер</Typography></div>
    {quote.loading ? <div className="site-booking-quote__loading" aria-live="polite">Обновляем стоимость…</div> : quote.error ? <div className="site-booking-quote__error">{quote.error}</div> : <BookingSummary lines={quote.lines} total={quote.total} note={quote.note ?? "Сумма не фиксирует бронь. Итог рассчитывается на сервере."} />}
  </aside>
}

export function ResourceBookingWizard({ className, extras, minDate, month, onApplyPromo, onChange, onOpenPrivacy, onSubmit, promoStatus, quote, resource, submitting = false, success, unavailable, value }: ResourceBookingWizardProps) {
  const [step, setStep] = useState(1)
  const patch = (next: Partial<ResourceBookingDraft>) => onChange({ ...value, ...next })
  const toggleExtra = (id: string) => patch({ extraIds: value.extraIds.includes(id) ? value.extraIds.filter((item) => item !== id) : [...value.extraIds, id] })
  const canContinueDates = Boolean(value.dates.from && value.dates.to)
  const canSubmit = Boolean(value.name.trim() && value.phone.trim() && value.consent)

  if (success) return <div className={cn("site-booking-success", className)}>
    <span className="site-booking-success__icon"><CheckCircle2 aria-hidden="true" /></span>
    <div><Typography variant="h3">Заявка зарегистрирована</Typography>{success.reference ? <Typography as="div" variant="eyebrow" tone="brand" className="site-booking-success__reference">Номер заявки: {success.reference}</Typography> : null}</div>
    <Typography tone="muted" variant="bodySm">{success.message ?? "Менеджер проверит доступность и свяжется с вами. Пока это заявка, а не подтверждённая бронь."}</Typography>
  </div>

  return <div className={cn("site-booking-wizard", className)}>
    <div className="site-booking-resource">
      {resource.image ? <img src={resource.image} alt={resource.imageAlt ?? ""} /> : <span className="site-booking-resource__placeholder"><Sparkles aria-hidden="true" /></span>}
      <div><Typography as="div" variant="eyebrow" tone="brand">Выбранный ресурс</Typography><Typography as="h3" variant="body" className="site-booking-resource__title">{resource.title}</Typography>{resource.description ? <Typography variant="caption" tone="muted">{resource.description}</Typography> : null}</div>
    </div>

    <nav className="site-booking-progress" aria-label="Шаги бронирования">{steps.map((item) => <button key={item.id} type="button" aria-current={step === item.id ? "step" : undefined} data-state={step === item.id ? "active" : step > item.id ? "complete" : "pending"} onClick={() => setStep(item.id)}><span>{step > item.id ? <Check aria-hidden="true" /> : item.id}</span><b className="site-booking-progress__long">{item.label}</b><b className="site-booking-progress__short">{item.shortLabel}</b></button>)}</nav>

    <div className="site-booking-layout">
      <section className="site-booking-step" aria-live="polite">
        {step === 1 ? <div className="site-booking-step__content">
          <StepIntro title="Когда вы хотите приехать?" description="Выберите даты и количество гостей." />
          <div className="site-booking-date-grid"><DateRangeCalendar value={value.dates} onChange={(dates) => patch({ dates })} {...(unavailable ? { unavailable } : {})} {...(minDate ? { minDate } : {})} {...(month ? { month } : {})} /><div className="site-booking-guests"><Typography variant="caption" className="site-booking-group-label">Гости</Typography><GuestStepper label="Взрослые" description="от 18 лет" value={value.adults} min={1} max={12} onChange={(adults) => patch({ adults })} /><GuestStepper label="Дети" description="до 17 лет" value={value.children} min={0} max={8} onChange={(children) => patch({ children })} /></div></div>
          <div className="site-booking-step__actions"><span /><Button type="button" disabled={!canContinueDates} onClick={() => setStep(2)}>Далее <ArrowRight aria-hidden="true" size={15} /></Button></div>
        </div> : null}

        {step === 2 ? <div className="site-booking-step__content">
          <StepIntro title="Дополните отдых" description="Опции можно пропустить. Итог подтвердит менеджер." />
          <div className="site-booking-extras">{extras.map((extra) => { const selected = value.extraIds.includes(extra.id); return <button type="button" key={extra.id} disabled={extra.unavailable} data-selected={selected || undefined} onClick={() => toggleExtra(extra.id)}><span className="site-booking-extra__icon">{extra.icon ?? <Gift aria-hidden="true" />}</span><span className="site-booking-extra__copy"><b>{extra.title}</b>{extra.description ? <small>{extra.description}</small> : null}</span><span className="site-booking-extra__price">{extra.priceLabel}</span><span className="site-booking-extra__check">{selected ? <Check aria-hidden="true" /> : null}</span></button> })}</div>
          <Field id="booking-promo" label="Промокод"><div className="site-booking-promo"><Input id="booking-promo" value={value.promoCode} placeholder="Например, GLAMP3000" onChange={(event) => patch({ promoCode: event.target.value.toUpperCase() })} /><Button type="button" variant="soft" disabled={!value.promoCode.trim()} onClick={() => onApplyPromo?.(value.promoCode)}><Tag aria-hidden="true" size={14} />Применить</Button></div>{promoStatus ? <Typography variant="caption" tone={promoStatus.tone === "success" ? "brand" : promoStatus.tone === "error" ? "muted" : "subtle"}>{promoStatus.message}</Typography> : null}</Field>
          <div className="site-booking-step__actions"><Button type="button" variant="muted" onClick={() => setStep(1)}><ChevronLeft aria-hidden="true" size={15} />Назад</Button><Button type="button" onClick={() => setStep(3)}>Далее <ArrowRight aria-hidden="true" size={15} /></Button></div>
        </div> : null}

        {step === 3 ? <form className="site-booking-step__content" onSubmit={(event) => { event.preventDefault(); if (canSubmit) onSubmit(value) }}>
          <StepIntro title="Как с вами связаться?" description="Оставьте контакт для ответа по этой заявке." />
          <ButtonGroup className="site-booking-contact-methods"><Button type="button" size="sm" aria-pressed={value.contactMethod === "phone"} variant={value.contactMethod === "phone" ? "primary" : "ghost"} onClick={() => patch({ contactMethod: "phone" })}><Phone aria-hidden="true" size={14} />Телефон</Button><Button type="button" size="sm" aria-pressed={value.contactMethod === "vk"} variant={value.contactMethod === "vk" ? "primary" : "ghost"} onClick={() => patch({ contactMethod: "vk" })}><Send aria-hidden="true" size={14} />ВКонтакте</Button><Button type="button" size="sm" aria-pressed={value.contactMethod === "telegram"} variant={value.contactMethod === "telegram" ? "primary" : "ghost"} onClick={() => patch({ contactMethod: "telegram" })}><MessageCircle aria-hidden="true" size={14} />Telegram</Button></ButtonGroup>
          <div className="site-booking-fields"><Field id="booking-name" label="Имя"><Input id="booking-name" autoComplete="name" value={value.name} placeholder="Как к вам обращаться" onChange={(event) => patch({ name: event.target.value })} /></Field><Field id="booking-phone" label="Телефон или контакт"><Input id="booking-phone" autoComplete="tel" value={value.phone} placeholder="+7 900 000-00-00" onChange={(event) => patch({ phone: event.target.value })} /></Field></div>
          <Checkbox checked={value.consent} onChange={(event) => patch({ consent: event.target.checked })} label={<span>Согласен на обработку данных. {onOpenPrivacy ? <button className="site-link" type="button" onClick={onOpenPrivacy}>Политика</button> : null}</span>} />
          <div className="site-booking-step__actions"><Button type="button" variant="muted" onClick={() => setStep(2)}><ChevronLeft aria-hidden="true" size={15} />Назад</Button><Button type="submit" loading={submitting} disabled={!canSubmit}>Зарегистрировать заявку</Button></div>
        </form> : null}
      </section>
      <QuotePanel quote={quote} />
    </div>
  </div>
}

export interface ResourceBookingDialogProps extends ResourceBookingWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ResourceBookingDialog({ onOpenChange, open, resource, ...props }: ResourceBookingDialogProps) {
  return <Dialog open={open} onOpenChange={onOpenChange} responsiveFullscreen className="site-booking-dialog" title="Заявка на бронирование" description={resource.title}><ResourceBookingWizard resource={resource} {...props} /></Dialog>
}
