import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, SiteSectionHeader, Tabs } from "@crm/site-ui";
import type { CmsHomeSectionConfig } from "@crm/contracts";
import {
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Send,
  Ticket,
  User,
} from "lucide-react";
import { HOUSES, POPULAR_PROGRAMS, PROMO_CODES, VENUES } from "../../data/resortData";
import { fireConfetti } from "../../utils/confetti";
import { listenForSiteEvent, SITE_EVENTS } from "../../../lib/site-events";

interface BookingQuizSectionProps {
  config: CmsHomeSectionConfig;
  onOpenPrivacyPolicy: () => void;
  onToast: (msg: string) => void;
  preselectedItem?: string;
}

type Kind = "glamping" | "venue" | "event";
const kindTabs = [
  { id: "glamping", label: "Отдых" },
  { id: "venue", label: "Площадка" },
  { id: "event", label: "Мероприятие" },
] as const;
const stepLabels = ["Что", "Дата", "Допы"];
const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const monthLabels = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const monthGenitiveLabels = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const addonOptions = [
  { id: "chan", title: "Сибирский чан", price: 4500, icon: "🔥", desc: "3 часа на живом огне" },
  { id: "sauna", title: "Кедровая русская баня", price: 5000, icon: "🪵", desc: "2 часа, веники и чай" },
  { id: "catering", title: "Фермерский сет", price: 3200, icon: "🥩", desc: "Мясо и овощи гриль" },
  { id: "animator", title: "Игра от «Зажигай»", price: 6000, icon: "🎈", desc: "1,5 часа с ведущим" },
];

const isoDate = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const fromIso = (value: string) => new Date(`${value}T12:00:00`);
const isBusyDate = (value: string) => fromIso(value).getDate() % 6 === 5;

function containsBusyDate(start: string, end: string) {
  const cursor = fromIso(start);
  const last = fromIso(end);
  while (cursor <= last) {
    if (isBusyDate(isoDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

function formatRange(start: string | null, end: string | null) {
  if (!start) return "даты не выбраны";
  const startDate = fromIso(start);
  const first = `${startDate.getDate()} ${monthGenitiveLabels[startDate.getMonth()]}`;
  if (!end) return `${first} — выберите дату выезда`;
  const endDate = fromIso(end);
  if (start === end) return first;
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()}–${endDate.getDate()} ${monthGenitiveLabels[startDate.getMonth()]}`;
  }
  return `${first} — ${endDate.getDate()} ${monthGenitiveLabels[endDate.getMonth()]}`;
}

export const BookingQuizSection: React.FC<BookingQuizSectionProps> = ({ config, onOpenPrivacyPolicy, onToast, preselectedItem }) => {
  const [activeTab, setActiveTab] = useState<Kind>("glamping");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedHouseId, setSelectedHouseId] = useState(HOUSES[0]!.id);
  const [selectedVenueId, setSelectedVenueId] = useState(VENUES[0]!.id);
  const [selectedProgramId, setSelectedProgramId] = useState(POPULAR_PROGRAMS[0]!.id);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [month, setMonth] = useState({ year: 2026, index: 8 });
  const [guestCount, setGuestCount] = useState(2);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({ chan: true });
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [contactMethod, setContactMethod] = useState<"phone" | "telegram" | "max">("phone");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [isConsentGiven, setIsConsentGiven] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!preselectedItem) return;
    const house = HOUSES.find((item) => item.title === preselectedItem || item.id === preselectedItem);
    const venue = VENUES.find((item) => item.title === preselectedItem || item.id === preselectedItem);
    const program = POPULAR_PROGRAMS.find((item) => item.title === preselectedItem || item.id === preselectedItem);
    if (house) { setActiveTab("glamping"); setSelectedHouseId(house.id); }
    else if (venue) { setActiveTab("venue"); setSelectedVenueId(venue.id); }
    else if (program) { setActiveTab("event"); setSelectedProgramId(program.id); }
  }, [preselectedItem]);

  const selected = useMemo(() => {
    if (activeTab === "glamping") {
      const item = HOUSES.find((house) => house.id === selectedHouseId) ?? HOUSES[0]!;
      return { title: item.title, price: item.priceFrom };
    }
    if (activeTab === "venue") {
      const item = VENUES.find((venue) => venue.id === selectedVenueId) ?? VENUES[0]!;
      return { title: item.title, price: 12_000 };
    }
    const item = POPULAR_PROGRAMS.find((program) => program.id === selectedProgramId) ?? POPULAR_PROGRAMS[0]!;
    return { title: item.title, price: 18_000 };
  }, [activeTab, selectedHouseId, selectedProgramId, selectedVenueId]);

  const addonTotal = addonOptions.reduce((sum, item) => sum + (selectedAddons[item.id] ? item.price : 0), 0);
  const rawTotal = selected.price + addonTotal;
  const finalTotal = Math.max(0, rawTotal - (appliedPromo?.discount ?? 0));
  const rangeSummary = formatRange(rangeStart, rangeEnd);
  const checkoutDate = rangeEnd ?? rangeStart ?? "";

  const applyPromoCode = useCallback((code: string, announce = true) => {
    const normalized = code.trim().toUpperCase();
    const found = PROMO_CODES.find((promo) => promo.code === normalized);
    if (!found) {
      setPromoInput(normalized);
      setAppliedPromo(null);
      if (announce) onToast("Промокод не найден или устарел");
      return;
    }
    const discount = found.id === "glamp" ? 3000 : found.id === "kids" ? 1000 : Math.round(rawTotal * .2);
    setPromoInput(found.code);
    setAppliedPromo({ code: found.code, discount });
    if (announce) { fireConfetti(); onToast(`Промокод ${found.code} применен! Скидка: ${discount.toLocaleString("ru-RU")} ₽`); }
  }, [onToast, rawTotal]);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.promo, ({ code }) => applyPromoCode(code, false)), [applyPromoCode]);

  const submit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rangeStart) { onToast("Пожалуйста, выберите даты поездки"); return; }
    if (!userPhone.trim()) { onToast("Пожалуйста, укажите номер телефона"); return; }
    if (!isConsentGiven) { onToast("Необходимо согласие на обработку данных"); return; }
    setIsSubmitted(true);
    fireConfetti();
    onToast("Заявка успешно отправлена! Менеджер свяжется с вами в течение 10 минут.");
  };

  const firstDayOffset = (new Date(month.year, month.index, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.year, month.index + 1, 0).getDate();
  const moveMonth = (delta: number) => setMonth((value) => {
    const next = new Date(value.year, value.index + delta, 1);
    return { year: next.getFullYear(), index: next.getMonth() };
  });
  const chooseDay = (date: string) => {
    if (!rangeStart || rangeEnd || date < rangeStart) {
      setRangeStart(date);
      setRangeEnd(null);
      return;
    }
    if (containsBusyDate(rangeStart, date)) {
      onToast("В диапазоне есть занятая дата — выберите более короткий период");
      return;
    }
    setRangeEnd(date);
  };
  const changeKind = (value: string) => {
    setActiveTab(value as Kind);
    setRangeStart(null);
    setRangeEnd(null);
  };

  return <section
    id="quiz"
    data-section-key="calculator"
    data-site-component="booking-calculator"
    data-applied-promo={appliedPromo?.code}
    data-date-start={rangeStart ?? ""}
    data-date-end={rangeEnd ?? ""}
    className="w-full py-8"
  >
    <SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Calculator className="w-3 h-3" />} eyebrowTone="brand" title={config.title} description={config.description} />

    <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
      <div className="lg:hidden sticky top-3 z-30 bg-surface rounded-[var(--site-radius-xl)] px-5 py-3 flex items-center justify-between gap-3">
        <div><div className="text-[11px] text-ink-3">Предварительная цена</div><div className="text-[22px] font-semibold tracking-[-.8px] leading-none"><span>от </span><span data-calculated-price>{finalTotal.toLocaleString("ru-RU")} ₽</span></div></div>
        <div className="flex items-center gap-1" aria-label={`Шаг ${currentStep} из 3`}>{stepLabels.map((label, index) => <span key={label} className={`h-1.5 rounded-[var(--site-radius-round)] transition-all ${index + 1 === currentStep ? "w-6 bg-green" : index + 1 < currentStep ? "w-2 bg-green" : "w-2 bg-bg"}`} />)}</div>
      </div>

      <div className="lg:col-span-7 bg-surface rounded-[var(--site-radius-xl)] p-3 lg:p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Шаги расчёта">
          {stepLabels.map((label, index) => { const step = index + 1; return <button key={label} type="button" onClick={() => step <= currentStep && setCurrentStep(step)} className={`h-9 rounded-[var(--site-radius-round)] pl-1.5 pr-3.5 inline-flex items-center gap-2 text-[12px] font-medium shrink-0 transition-colors ${step === currentStep ? "bg-green text-white" : step < currentStep ? "bg-green-soft text-green-deep" : "bg-bg text-ink-3"}`}><span className={`w-6 h-6 rounded-[var(--site-radius-round)] inline-flex items-center justify-center text-[11px] ${step === currentStep ? "bg-white/20" : step < currentStep ? "bg-green text-white" : "bg-surface"}`}>{step < currentStep ? <Check size={11} strokeWidth={3} /> : step}</span>{label}</button>; })}
        </div>

        <div className="min-h-[290px]">
          {currentStep === 1 ? <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Tabs className="site-calculator-tabs" value={activeTab} renderPanel={false} onValueChange={changeKind} items={kindTabs.map((tab) => ({ ...tab, content: null }))} />
            {activeTab === "glamping" ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{HOUSES.map((house) => { const on = selectedHouseId === house.id; return <button key={house.id} type="button" aria-pressed={on} onClick={() => setSelectedHouseId(house.id)} className={`text-left rounded-[var(--site-radius-lg)] p-2 flex items-center gap-3 transition-colors ${on ? "bg-green-soft" : "bg-bg hover:bg-green-soft"}`}><span className="card-img w-14 h-14 !rounded-[var(--site-radius-sm)] shrink-0"><img src={house.photos[0]} alt="" /></span><span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold truncate">{house.title}</span><span className="block text-[11px] text-ink-3">до {house.capacityNumber} чел · за ночь</span><span className="block text-[13px] font-semibold mt-0.5">от {house.priceFrom.toLocaleString("ru-RU")} ₽</span></span><span className={`w-6 h-6 rounded-[var(--site-radius-round)] inline-flex items-center justify-center ${on ? "bg-green text-white" : "bg-surface text-transparent"}`}><Check size={12} /></span></button>; })}</div> : null}
            {activeTab === "venue" ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{VENUES.map((venue) => { const on = selectedVenueId === venue.id; return <button key={venue.id} type="button" aria-pressed={on} onClick={() => setSelectedVenueId(venue.id)} className={`text-left rounded-[var(--site-radius-lg)] p-3 transition-colors ${on ? "bg-green-soft" : "bg-bg hover:bg-green-soft"}`}><span className="flex items-center justify-between gap-2"><span className="text-[13px] font-semibold">{venue.title}</span>{on ? <Check size={13} className="text-green" /> : null}</span><span className="block text-[11px] text-ink-3 mt-1">{venue.capacity} · {venue.area}</span></button>; })}</div> : null}
            {activeTab === "event" ? <div className="flex flex-col gap-2">{POPULAR_PROGRAMS.map((program) => { const on = selectedProgramId === program.id; return <button key={program.id} type="button" aria-pressed={on} onClick={() => setSelectedProgramId(program.id)} className={`text-left rounded-[var(--site-radius-lg)] p-3 flex items-center justify-between gap-3 transition-colors ${on ? "bg-green-soft" : "bg-bg hover:bg-green-soft"}`}><span><span className="block text-[13px] font-semibold">{program.title}</span><span className="block text-[11px] text-ink-3 mt-1">{program.duration} · {program.age}</span></span><span className={`w-6 h-6 rounded-[var(--site-radius-round)] inline-flex items-center justify-center ${on ? "bg-green text-white" : "bg-surface text-transparent"}`}><Check size={12} /></span></button>; })}</div> : null}
          </div> : null}

          {currentStep === 2 ? <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between"><button type="button" onClick={() => moveMonth(-1)} className="arrow-bubble !bg-bg" aria-label="Предыдущий месяц"><ChevronLeft size={16} /></button><span className="text-[15px] font-semibold capitalize">{monthLabels[month.index]} {month.year}</span><button type="button" onClick={() => moveMonth(1)} className="arrow-bubble !bg-bg" aria-label="Следующий месяц"><ChevronRight size={16} /></button></div>
            <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`Выбор диапазона: ${monthLabels[month.index]} ${month.year}`}>{weekDays.map((day) => <span key={day} role="columnheader" className="text-[11px] text-ink-3 py-1">{day}</span>)}{Array.from({ length: firstDayOffset }, (_, index) => <span key={`offset-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const date = isoDate(month.year, month.index, day);
              const busy = isBusyDate(date);
              const endpoint = date === rangeStart || date === rangeEnd;
              const inRange = Boolean(rangeStart && rangeEnd && date > rangeStart && date < rangeEnd);
              const selectedDay = endpoint || inRange;
              return <button key={day} type="button" role="gridcell" data-calendar-day={day} data-range-position={endpoint ? "endpoint" : inRange ? "within" : undefined} disabled={busy} aria-pressed={selectedDay} aria-label={`${day} ${monthLabels[month.index]} ${month.year}${busy ? ", недоступно" : endpoint ? ", граница выбранного диапазона" : inRange ? ", входит в выбранный диапазон" : ", доступно"}`} onClick={() => chooseDay(date)} className={`h-10 lg:h-11 rounded-[var(--site-radius-md)] text-[13px] font-medium transition-[background-color,color,transform] duration-300 ease-[var(--site-ease)] ${busy ? "bg-bg text-ink-3 opacity-60 line-through" : endpoint ? "bg-green text-white scale-[1.04]" : inRange ? "bg-green-soft text-green-deep" : "bg-green-soft text-green-deep hover:bg-green hover:text-white"}`}>{day}</button>;
            })}</div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-ink-3"><span className="flex items-center gap-4"><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-green-soft" />свободно</span><span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[4px] bg-bg" />занято</span></span><span aria-live="polite" data-date-summary className="text-right">{rangeSummary}</span></div>
          </div> : null}

          {currentStep === 3 ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-right-4 duration-300">{addonOptions.map((item) => { const on = Boolean(selectedAddons[item.id]); return <button key={item.id} type="button" aria-pressed={on} onClick={() => setSelectedAddons((value) => ({ ...value, [item.id]: !value[item.id] }))} className={`text-left rounded-[var(--site-radius-lg)] p-2.5 flex items-center gap-3 transition-colors ${on ? "bg-green-soft" : "bg-bg hover:bg-green-soft"}`}><span className="icon-tile !bg-surface text-[18px]">{item.icon}</span><span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold">{item.title}</span><span className="block text-[11px] text-ink-3">{item.desc} · +{item.price.toLocaleString("ru-RU")} ₽</span></span><span className={`w-7 h-7 rounded-[var(--site-radius-round)] inline-flex items-center justify-center ${on ? "bg-green text-white" : "bg-surface text-ink"}`}>{on ? <Check size={13} /> : <Plus size={13} />}</span></button>; })}</div> : null}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="muted" disabled={currentStep === 1} onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}>Назад</Button>
          {currentStep < 3 ? <Button disabled={currentStep === 2 && !rangeStart} onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}>{currentStep === 2 && !rangeStart ? "Выберите даты" : "Далее"} <ArrowRight size={14} /></Button> : <span className="text-[12px] text-ink-3">Контакты в форме <span className="max-lg:hidden">справа →</span><span className="lg:hidden">ниже ↓</span></span>}
        </div>
      </div>

      <aside className="lg:col-span-5 lg:sticky lg:top-6">
        <div className="px-5 py-5 sm:p-6 rounded-[var(--site-radius-xl)] bg-surface flex flex-col gap-4">
          <div aria-live="polite"><div className="text-[11px] text-ink-3">Предварительная цена</div><div className="flex items-baseline gap-2 mt-1"><span className="text-[32px] font-semibold tracking-[-1px] leading-none"><span>от </span><span data-calculated-price>{finalTotal.toLocaleString("ru-RU")} ₽</span></span>{appliedPromo ? <span className="text-[13px] text-ink-3 line-through">{rawTotal.toLocaleString("ru-RU")} ₽</span> : null}</div><div className="text-[12px] text-ink-2 mt-2 line-clamp-2">{selected.title} · <span data-date-summary>{rangeSummary}</span></div></div>
          <div className="flex items-center justify-between rounded-[var(--site-radius-round)] bg-bg pl-4 pr-1 py-1"><span className="text-[13px] font-medium inline-flex items-center gap-2"><User size={14} />Количество гостей</span><span className="inline-flex items-center gap-1"><button type="button" onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="w-9 h-9 rounded-[var(--site-radius-round)] bg-surface inline-flex items-center justify-center hover:bg-green hover:text-white transition-colors" aria-label="Меньше гостей"><Minus size={13} /></button><span className="w-9 text-center text-[14px] font-semibold">{guestCount}</span><button type="button" onClick={() => setGuestCount(Math.min(300, guestCount + 1))} className="w-9 h-9 rounded-[var(--site-radius-round)] bg-surface inline-flex items-center justify-center hover:bg-green hover:text-white transition-colors" aria-label="Больше гостей"><Plus size={13} /></button></span></div>
          <div className="relative h-11 rounded-[var(--site-radius-round)] bg-bg"><Ticket size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" /><Input aria-label="Промокод" placeholder="Введите промокод" value={promoInput} onChange={(event) => setPromoInput(event.target.value)} className="site-promo-input !h-11 !min-h-11 !rounded-[var(--site-radius-round)] !pl-10 !pr-14 !text-[14px] uppercase font-mono placeholder:normal-case placeholder:font-sans" /><button type="button" onClick={() => applyPromoCode(promoInput)} className="absolute right-0 top-0 w-11 h-11 rounded-[var(--site-radius-round)] bg-green text-white inline-flex items-center justify-center hover:bg-green-deep transition-colors" title="Применить промокод" aria-label="Применить промокод"><Gift size={15} /></button></div>
          {!isSubmitted ? <form onSubmit={submit} className="flex flex-col gap-3" data-intake-range={`${rangeStart ?? ""}/${checkoutDate}`}>
            <input type="hidden" name="dateStart" value={rangeStart ?? ""} />
            <input type="hidden" name="dateEnd" value={checkoutDate} />
            <input type="hidden" name="guestCount" value={guestCount} />
            <div><div className="text-[11px] text-ink-3 mb-1.5">Куда ответить</div><div className="grid grid-cols-3 gap-1.5">{([{ id: "phone", label: "Звонок", Icon: Phone }, { id: "max", label: "MAX", Icon: MessageCircle }, { id: "telegram", label: "Telegram", Icon: Send }] as const).map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => setContactMethod(id)} className={`h-11 rounded-[var(--site-radius-round)] text-[12px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${contactMethod === id ? "bg-green text-white" : "bg-bg text-ink hover:bg-green-soft"}`}><Icon size={13} />{label}</button>)}</div></div>
            <Input aria-label="Ваше имя" required placeholder="Ваше имя" value={userName} onChange={(event) => setUserName(event.target.value)} autoComplete="name" className="!h-11 !min-h-11 !rounded-[var(--site-radius-round)] !px-[18px] !text-[14px]" />
            <Input aria-label="Телефон" required type="tel" placeholder="+7 (___) ___-__-__" value={userPhone} onChange={(event) => setUserPhone(event.target.value)} autoComplete="tel" className="!h-11 !min-h-11 !rounded-[var(--site-radius-round)] !px-[18px] !text-[14px]" />
            <label className="flex items-start gap-2.5 cursor-pointer text-[12px] text-ink-2 leading-snug"><span aria-hidden="true" className={`mt-0.5 w-5 h-5 rounded-[var(--site-radius-xs)] inline-flex items-center justify-center shrink-0 transition-colors ${isConsentGiven ? "bg-green text-white" : "bg-bg"}`}>{isConsentGiven ? <Check size={12} strokeWidth={3} /> : null}</span><input type="checkbox" aria-label="Согласие на обработку персональных данных" checked={isConsentGiven} onChange={(event) => setIsConsentGiven(event.target.checked)} className="sr-only" /><span>Даю согласие на обработку персональных данных в соответствии с <button type="button" onClick={onOpenPrivacyPolicy} className="text-green-deep underline underline-offset-2">политикой</button>.</span></label>
            <button type="submit" className="btn btn-primary w-full justify-between"><span>Отправить заявку</span><span className="btn-arrow"><ArrowRight size={15} /></span></button>
          </form> : <div className="rounded-[var(--site-radius-lg)] bg-green-soft p-5 text-center animate-in zoom-in-95"><span className="w-11 h-11 rounded-[var(--site-radius-round)] bg-green text-white inline-flex items-center justify-center"><CheckCircle2 size={21} /></span><h4 className="text-[16px] font-semibold mt-3">Заявка принята!</h4><p className="text-[12px] text-ink-2 mt-2">Спасибо, {userName || "гость"}! Менеджер подтвердит условия и свяжется с вами.</p><button type="button" onClick={() => setIsSubmitted(false)} className="text-[12px] text-green-deep font-medium underline mt-3">Рассчитать заново</button></div>}
        </div>
      </aside>
    </div>
  </section>;
};
