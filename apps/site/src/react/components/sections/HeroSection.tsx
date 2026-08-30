import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Copy,
  Check,
  Send,
  Phone
} from 'lucide-react';
import { PROMO_CODES, RESORT_IMAGES } from '../../data/resortData';
import { fireConfetti } from '../../utils/confetti';

interface HeroSectionProps {
  onOpenBookingModal: (itemName?: string) => void;
  onOpenCallModal: () => void;
  onNavigate: (sectionId: string) => void;
  onToast: (msg: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenBookingModal,
  onOpenCallModal,
  onNavigate,
  onToast
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const heroSlides = [
    {
      image: RESORT_IMAGES.heroGlamping,
      title: "Глэмпинг в Кирове — дома с чаном и баней",
      tagline: "Тишина соснового бора, панорамные окна и горячая купель под открытым небом"
    },
    {
      image: RESORT_IMAGES.heroSunset,
      title: "Отдых с сибирским чаном среди сосен",
      tagline: "Парение на березовых дровах с пихтовыми ветками и цитрусами"
    },
    {
      image: RESORT_IMAGES.heroNight,
      title: "Праздники и свадьбы на природе",
      tagline: "Светлый банкетный зал, сцена, панорамная веранда и команда «Зажигай»"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const handleCopyPromo = (code: string, amount: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    fireConfetti();
    onToast(`Промокод ${code} скопирован! Примените скидку ${amount}`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <section id="hero" className="relative w-full pt-2 pb-6">
      {/* 1. Main Hero Card (520px height on desktop) */}
      <div className="relative w-full rounded-3xl overflow-hidden bg-neutral-900 min-h-[480px] lg:h-[520px] flex flex-col justify-between p-6 sm:p-8 lg:p-10 text-white">
        {/* Background Slider Images */}
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              currentSlide === index ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover scale-105 transition-transform duration-[8000ms] ease-out"
            />
            {/* Darkening gradient overlay for high contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
          </div>
        ))}

        {/* Hero Top Bar inside Image */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          {/* Badge: 30 минут от Кирова */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[12px] font-medium">
            <MapPin className="w-3.5 h-3.5 text-[#FAAB2B]" />
            <span>30 минут от Кирова</span>
          </div>

          {/* Slide Indicators */}
          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2.5 py-1.5 rounded-full">
            {heroSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Слайд ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Hero Bottom & Main Heading Area */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mt-auto">
          {/* Left Column: Heading + Tagline + Main CTAs */}
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2B9E47]/90 text-[10px] font-semibold tracking-wider uppercase text-white">
              <Sparkles className="w-3 h-3" />
              База отдыха и глэмпинг
            </div>

            <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-semibold text-white leading-[1.08] tracking-tight max-w-2xl">
              Глэмпинг в&nbsp;Кирове — дома с&nbsp;чаном и&nbsp;баней
            </h1>

            <p className="text-[14px] sm:text-[15px] text-neutral-200 leading-relaxed max-w-xl font-normal">
              {heroSlides[currentSlide]!.tagline}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Primary: Забронировать with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setBookingDropdownOpen(!bookingDropdownOpen)}
                  className="h-[44px] px-6 rounded-full bg-[#2B9E47] text-white text-[14px] font-medium inline-flex items-center gap-3 hover:bg-[#23823a] transition-all group shadow-sm"
                >
                  <span>Забронировать</span>
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ChevronDown className={`w-4 h-4 transition-transform ${bookingDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Dropdown Menu */}
                {bookingDropdownOpen && (
                  <div className="absolute top-[50px] left-0 w-64 bg-white text-[#18191b] rounded-2xl p-2 border border-neutral-200 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        setBookingDropdownOpen(false);
                        onOpenBookingModal();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f7f7f7] text-left text-[13px] font-medium transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#2B9E47]/10 text-[#2B9E47] flex items-center justify-center shrink-0">
                        <Send className="w-4 h-4 -rotate-12" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">ВКонтакте</div>
                        <div className="text-[11px] text-[#6b7280]">Ответ за 3 минуты</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setBookingDropdownOpen(false);
                        onOpenCallModal();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f7f7f7] text-left text-[13px] font-medium transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 text-[#18191b] flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">Позвонить</div>
                        <div className="text-[11px] text-[#6b7280]">2 телефонные линии</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Secondary CTA: Мероприятия */}
              <button
                onClick={() => onNavigate('programs')}
                className="h-[44px] px-6 rounded-full bg-white/20 backdrop-blur-md text-white text-[14px] font-medium inline-flex items-center gap-3 hover:bg-white/30 transition-all group"
              >
                <span>Мероприятия</span>
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          </div>

          {/* Right Column: Vertical CTA Cards on Desktop over Hero */}
          <div className="hidden lg:flex lg:col-span-4 flex-col gap-3">
            {/* Card 1: Выбрать домик */}
            <div
              onClick={() => onNavigate('houses')}
              className="p-3 rounded-2xl bg-white text-[#18191b] flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-center gap-3">
                <div className="w-16 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                  <img
                    src={RESORT_IMAGES.houseGnezdo1}
                    alt="Выбрать домик"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-[#18191b] leading-tight">
                    Выбрать домик
                  </div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">
                    «Гнездо» и «Дом на дереве»
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Card 2: Провести мероприятие */}
            <div
              onClick={() => onNavigate('programs')}
              className="p-3 rounded-2xl bg-white text-[#18191b] flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform group"
            >
              <div className="flex items-center gap-3">
                <div className="w-16 h-14 rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                  <img
                    src={RESORT_IMAGES.venueBanquet}
                    alt="Провести мероприятие"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-[#18191b] leading-tight">
                    Провести мероприятие
                  </div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5">
                    Свадьба, банкет, квест, корпоратив
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#18191b] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Promo Code Cards Grid (Swiss style, copy button with confetti) */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROMO_CODES.map((promo) => {
          const isCopied = copiedCode === promo.code;

          return (
            <div
              key={promo.id}
              className="p-4 rounded-2xl bg-white flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3.5">
                {/* Square pill emoji icon */}
                <div className="w-11 h-11 rounded-2xl bg-[#f7f7f7] flex items-center justify-center text-lg shrink-0">
                  {promo.emoji}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-semibold text-[#18191b] tracking-tight">
                      {promo.amount}
                    </span>
                    {/* Promo code badge with colored background */}
                    <span 
                      className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold"
                      style={{ backgroundColor: `${promo.colorBg}18`, color: promo.colorBg }}
                    >
                      {promo.code}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#6b7280] mt-0.5 line-clamp-1">
                    {promo.desc}
                  </div>
                </div>
              </div>

              {/* Copy button with icon without text, confetti trigger */}
              <button
                onClick={() => handleCopyPromo(promo.code, promo.amount)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ml-2 ${
                  isCopied
                    ? 'bg-[#2B9E47] text-white'
                    : 'bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200'
                }`}
                title="Скопировать промокод"
                aria-label="Скопировать промокод"
              >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};
