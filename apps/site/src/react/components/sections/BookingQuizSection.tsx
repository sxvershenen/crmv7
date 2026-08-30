import React, { useState } from 'react';
import {
  Calculator,
  Home,
  Layers,
  Sparkles,
  Check,
  Phone,
  Send,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  Gift
} from 'lucide-react';
import { HOUSES, VENUES, POPULAR_PROGRAMS, PROMO_CODES } from '../../data/resortData';
import { fireConfetti } from '../../utils/confetti';

interface BookingQuizSectionProps {
  onOpenPrivacyPolicy: () => void;
  onToast: (msg: string) => void;
  preselectedItem?: string;
}

export const BookingQuizSection: React.FC<BookingQuizSectionProps> = ({
  onOpenPrivacyPolicy,
  onToast
}) => {
  // Tabs: 'glamping' | 'venue' | 'event'
  const [activeTab, setActiveTab] = useState<'glamping' | 'venue' | 'event'>('glamping');

  // Step state (1: Resource selection, 2: Date & Guests, 3: Add-ons, 4: Contacts for mobile)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Selections
  const [selectedHouseId, setSelectedHouseId] = useState<string>(HOUSES[0]!.id);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(VENUES[0]!.id);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(POPULAR_PROGRAMS[0]!.id);

  // Date selection (simulated interactive days)
  const [selectedDate, setSelectedDate] = useState<string>("2025-03-22");
  const [guestCount, setGuestCount] = useState<number>(2);

  // Add-ons
  const [selectedAddons, setSelectedAddons] = useState<{ [key: string]: boolean }>({
    chan: true,
    sauna: false,
    catering: false,
    animator: false
  });

  // Promo Code
  const [promoInput, setPromoInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);

  // Contact form
  const [contactMethod, setContactMethod] = useState<'phone' | 'telegram' | 'max'>('phone');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [isConsentGiven, setIsConsentGiven] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Available add-on options
  const addonOptions = [
    { id: 'chan', title: 'Сибирский чан с пихтой и цитрусами', price: 4500, icon: '🔥', desc: '3 часа парения на живом огне' },
    { id: 'sauna', title: 'Кедровая русская баня на березе', price: 5000, icon: '🪵', desc: '2 часа + веники и чай' },
    { id: 'catering', title: 'Фермерский сет для барбекю на углях', price: 3200, icon: '🥩', desc: 'Мясо, соусы, овощи гриль' },
    { id: 'animator', title: 'Интерактивная игра от «Зажигай»', price: 6000, icon: '🎈', desc: '1.5 часа квеста для детей/взрослых' }
  ];

  // Price Calculation
  const calculateBasePrice = () => {
    if (activeTab === 'glamping') {
      const house = HOUSES.find((h) => h.id === selectedHouseId);
      return house ? house.priceFrom : 6500;
    } else if (activeTab === 'venue') {
      return 12000;
    } else {
      return 18000;
    }
  };

  const calculateAddonsPrice = () => {
    return addonOptions.reduce((sum, item) => {
      return selectedAddons[item.id] ? sum + item.price : sum;
    }, 0);
  };

  const rawTotal = calculateBasePrice() + calculateAddonsPrice();
  const discountAmount = appliedPromo ? appliedPromo.discount : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  // Promo handling
  const handleApplyPromo = () => {
    const trimmed = promoInput.trim().toUpperCase();
    const found = PROMO_CODES.find((p) => p.code === trimmed);

    if (found) {
      const discountVal = found.id === 'glamp' ? 3000 : found.id === 'kids' ? 1000 : Math.round(rawTotal * 0.2);
      setAppliedPromo({ code: found.code, discount: discountVal });
      fireConfetti();
      onToast(`Промокод ${found.code} применен! Скидка: ${discountVal.toLocaleString('ru-RU')} ₽`);
    } else {
      onToast('Промокод не найден или устарел');
    }
  };

  // Form submission
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userPhone.trim()) {
      onToast('Пожалуйста, укажите номер телефона');
      return;
    }
    if (!isConsentGiven) {
      onToast('Необходимо согласие на обработку данных');
      return;
    }

    setIsSubmitted(true);
    fireConfetti();
    onToast('Заявка успешно отправлена! Менеджер свяжется с вами в течение 10 минут.');
  };

  // Dates for simulated calendar
  const calendarDays = [
    { date: "2025-03-20", day: "20", weekday: "ЧТ", available: true },
    { date: "2025-03-21", day: "21", weekday: "ПТ", available: false },
    { date: "2025-03-22", day: "22", weekday: "СБ", available: true },
    { date: "2025-03-23", day: "23", weekday: "ВС", available: true },
    { date: "2025-03-24", day: "24", weekday: "ПН", available: true },
    { date: "2025-03-25", day: "25", weekday: "ВТ", available: true },
    { date: "2025-03-26", day: "26", weekday: "СР", available: false },
  ];

  return (
    <section id="quiz" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <Calculator className="w-3 h-3 text-[#2B9E47]" />
          Интерактивный расчет
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Калькулятор отдыха и праздника
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Соберите ваш индивидуальный пакет за&nbsp;3&nbsp;шага и&nbsp;зафиксируйте скидку по&nbsp;промокоду
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Step-by-Step Selection Engine */}
        <div className="lg:col-span-7 space-y-4">
          {/* Format Selection Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white shadow-xs">
            <button
              onClick={() => {
                setActiveTab('glamping');
                setCurrentStep(1);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[12px] sm:text-[13px] font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'glamping'
                  ? 'bg-[#2B9E47] text-white shadow-xs'
                  : 'text-[#18191b] hover:bg-[#f7f7f7]'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Отдых в домике</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('venue');
                setCurrentStep(1);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[12px] sm:text-[13px] font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'venue'
                  ? 'bg-[#2B9E47] text-white shadow-xs'
                  : 'text-[#18191b] hover:bg-[#f7f7f7]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Площадка</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('event');
                setCurrentStep(1);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-[12px] sm:text-[13px] font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'event'
                  ? 'bg-[#2B9E47] text-white shadow-xs'
                  : 'text-[#18191b] hover:bg-[#f7f7f7]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Праздник</span>
            </button>
          </div>

          {/* Steps Progress Indicator */}
          <div className="p-4 rounded-3xl bg-white">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#2B9E47] text-white text-[11px] font-bold flex items-center justify-center">
                  {currentStep}
                </span>
                <span className="text-[14px] font-semibold text-[#18191b]">
                  {currentStep === 1 && 'Шаг 1: Выберите объект'}
                  {currentStep === 2 && 'Шаг 2: Дата и гости'}
                  {currentStep === 3 && 'Шаг 3: Дополнительные опции'}
                  {currentStep === 4 && 'Шаг 4: Контакты для брони'}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <button
                    key={step}
                    onClick={() => setCurrentStep(step)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentStep === step ? 'w-5 bg-[#2B9E47]' : 'bg-neutral-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* STEP 1: Resource Picker */}
            {currentStep === 1 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {activeTab === 'glamping' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {HOUSES.map((house) => {
                      const isSelected = selectedHouseId === house.id;

                      return (
                        <div
                          key={house.id}
                          onClick={() => setSelectedHouseId(house.id)}
                          className={`relative aspect-video overflow-hidden rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#2B9E47] ring-2 ring-[#2B9E47]/20'
                              : 'border-transparent hover:border-neutral-300'
                          }`}
                        >
                          <img src={house.photos[0]} alt={house.title} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                          <span className="absolute bottom-3 left-3 right-3 truncate text-[14px] font-semibold text-white">{house.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'venue' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {VENUES.map((venue) => {
                      const isSelected = selectedVenueId === venue.id;

                      return (
                        <div
                          key={venue.id}
                          onClick={() => setSelectedVenueId(venue.id)}
                          className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#2B9E47] bg-[#eaf5ec]'
                              : 'border-transparent bg-[#f7f7f7] hover:bg-neutral-200'
                          }`}
                        >
                          <div className="text-[13px] font-semibold text-[#18191b]">{venue.title}</div>
                          <div className="text-[11px] text-[#6b7280]">{venue.capacity} • {venue.area}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'event' && (
                  <div className="space-y-2">
                    {POPULAR_PROGRAMS.slice(0, 3).map((prog) => {
                      const isSelected = selectedProgramId === prog.id;

                      return (
                        <div
                          key={prog.id}
                          onClick={() => setSelectedProgramId(prog.id)}
                          className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-[#2B9E47] bg-[#eaf5ec]'
                              : 'border-transparent bg-[#f7f7f7] hover:bg-neutral-200'
                          }`}
                        >
                          <div>
                            <div className="text-[13px] font-semibold text-[#18191b]">{prog.title}</div>
                            <div className="text-[11px] text-[#6b7280]">{prog.duration} • {prog.age}</div>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                            {isSelected ? <Check className="w-3.5 h-3.5 text-[#2B9E47]" /> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-3 flex justify-end">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="h-[40px] px-5 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium flex items-center gap-2 hover:bg-[#23823a]"
                  >
                    <span>Далее: Дата и гости</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Interactive Date & Guests */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <label className="text-[12px] font-semibold text-[#18191b] mb-2 block">
                    Выберите свободную дату заезда:
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {calendarDays.map((item) => {
                      const isSelected = selectedDate === item.date;

                      return (
                        <button
                          key={item.date}
                          disabled={!item.available}
                          onClick={() => setSelectedDate(item.date)}
                          className={`p-2 rounded-2xl text-center flex flex-col items-center justify-center transition-all ${
                            !item.available
                              ? 'bg-neutral-100 text-neutral-400 opacity-50 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-[#2B9E47] text-white shadow-sm'
                              : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                          }`}
                        >
                          <span className="text-[10px] font-medium">{item.weekday}</span>
                          <span className="text-[16px] font-bold">{item.day}</span>
                          <span className="text-[9px] mt-0.5">
                            {item.available ? (isSelected ? 'Выбрано' : 'Свободно') : 'Занято'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Guest counter */}
                <div>
                  <label className="text-[12px] font-semibold text-[#18191b] mb-2 block">
                    Количество гостей:
                  </label>
                  <div className="flex items-center gap-3">
                    {[1, 2, 3, 4, 6, 8, 12].map((num) => (
                      <button
                        key={num}
                        onClick={() => setGuestCount(num)}
                        className={`w-10 h-10 rounded-2xl text-[13px] font-semibold transition-all ${
                          guestCount === num
                            ? 'bg-[#18191b] text-white'
                            : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-[13px] text-[#6b7280] hover:text-[#18191b]"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="h-[40px] px-5 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium flex items-center gap-2 hover:bg-[#23823a]"
                  >
                    <span>Далее: Дополнительные опции</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Add-ons */}
            {currentStep === 3 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="text-[12px] font-semibold text-[#18191b] mb-1">
                  Доступно на выбранную дату ({selectedDate}):
                </div>

                <div className="space-y-2">
                  {addonOptions.map((item) => {
                    const isChecked = !!selectedAddons[item.id];

                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          setSelectedAddons((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'border-[#2B9E47] bg-[#eaf5ec]'
                            : 'border-transparent bg-[#f7f7f7] hover:bg-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{item.icon}</span>
                          <div>
                            <div className="text-[13px] font-semibold text-[#18191b]">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#6b7280]">{item.desc}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[13px] font-semibold text-[#18191b]">
                            +{item.price.toLocaleString('ru-RU')} ₽
                          </span>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isChecked ? 'bg-[#2B9E47] text-white' : 'bg-white'
                            }`}
                          >
                            {isChecked ? <Check className="w-3.5 h-3.5" /> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="text-[13px] text-[#6b7280] hover:text-[#18191b]"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="h-[40px] px-5 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium flex items-center gap-2 hover:bg-[#23823a]"
                  >
                    <span>Перейти к оформлению</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 (Mobile view) */}
            {currentStep === 4 && (
              <div className="lg:hidden space-y-4 animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-[#f7f7f7]">
                  <div className="text-[12px] text-[#6b7280]">Предварительный итог:</div>
                  <div className="text-[26px] font-semibold text-[#2B9E47]">
                    {finalTotal.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sticky Sidebar: Live Price, Promo Code & Contact Form */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white space-y-4">
            {/* Price Preview Header */}
            <div>
              <div className="text-[11px] uppercase font-semibold text-[#6b7280] tracking-wider">
                Предварительная стоимость
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[32px] font-semibold text-[#2B9E47] tracking-tight">
                  {finalTotal.toLocaleString('ru-RU')} ₽
                </span>
                {appliedPromo && (
                  <span className="text-[14px] text-neutral-400 line-through">
                    {rawTotal.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#6b7280] mt-0.5">
                Дата: {selectedDate} • {guestCount} человек
              </div>
            </div>

            {/* Promo Code Input Box */}
            <div className="flex items-center gap-2 rounded-2xl bg-[#f7f7f7] px-3 py-2">
                <input
                  type="text"
                  placeholder="Введите промокод"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  className="flex-1 h-[40px] bg-transparent text-[12px] uppercase font-mono text-[#18191b] placeholder:normal-case placeholder:font-sans placeholder:text-[#6b7280] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="w-10 h-10 rounded-full bg-[#2B9E47] text-white flex items-center justify-center hover:bg-[#23823a] transition-colors"
                  title="Применить промокод"
                >
                  <Gift className="w-4 h-4" />
                </button>
            </div>

            {/* Form */}
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-3 pt-1">
                {/* Where to respond: Phone / Telegram / MAX */}
                <div>
                  <label className="text-[11px] font-semibold text-[#18191b] mb-1.5 block">
                    Куда вам ответить?
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setContactMethod('phone')}
                      className={`h-[36px] rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        contactMethod === 'phone'
                          ? 'bg-[#18191b] text-white'
                          : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                      }`}
                    >
                      <Phone className="w-3 h-3" />
                      <span>Звонок</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setContactMethod('telegram')}
                      className={`h-[36px] rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        contactMethod === 'telegram'
                          ? 'bg-[#2B9E47] text-white'
                          : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                      }`}
                    >
                      <Send className="w-3 h-3 -rotate-12" />
                      <span>Telegram</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setContactMethod('max')}
                      className={`h-[36px] rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        contactMethod === 'max'
                          ? 'bg-[#FAAB2B] text-white'
                          : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                      }`}
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>ВКонтакте</span>
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Ваше имя"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full h-[40px] px-3.5 rounded-2xl bg-[#f7f7f7] text-[13px] text-[#18191b] placeholder:text-[#6b7280] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#2B9E47]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <input
                    type="tel"
                    required
                    placeholder="+7 (___) ___-__-__"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full h-[40px] px-3.5 rounded-2xl bg-[#f7f7f7] text-[13px] text-[#18191b] placeholder:text-[#6b7280] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#2B9E47]"
                  />
                </div>

                {/* Personal data consent checkbox */}
                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="consentQuiz"
                    checked={isConsentGiven}
                    onChange={(e) => setIsConsentGiven(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-[#2B9E47] focus:ring-[#2B9E47] cursor-pointer"
                  />
                  <label htmlFor="consentQuiz" className="text-[11px] text-[#6b7280] leading-snug cursor-pointer select-none">
                    Даю согласие на обработку персональных данных в соответствии с{' '}
                    <button
                      type="button"
                      onClick={onOpenPrivacyPolicy}
                      className="text-[#2B9E47] underline hover:text-[#23823a]"
                    >
                      политикой обработки персональных данных
                    </button>
                    .
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full h-[48px] rounded-full bg-[#2B9E47] hover:bg-[#23823a] text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <span>Забронировать расчет</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* Success confirmation view */
              <div className="p-6 rounded-2xl bg-[#eaf5ec] text-center space-y-3 animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-[#2B9E47] text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-[16px] font-semibold text-[#18191b]">
                  Заявка принята!
                </h4>
                <p className="text-[12px] text-[#2d3134] leading-relaxed">
                  Спасибо, {userName || 'гость'}! Мы уже зарезервировали условия для даты {selectedDate} и перезвоним вам в ближайшие минуты.
                </p>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-[12px] text-[#2B9E47] font-medium underline"
                >
                  Рассчитать заново
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </section>
  );
};
