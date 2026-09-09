import { useEffect, useRef, useState } from "react"
import { ArrowRight, CalendarDays, Check, ChevronDown, Copy, MapPin, Phone, Send, Ticket } from "lucide-react"

import type { SiteHeroConfig, SiteHeroCta } from "../content-model"
import { SiteSecondaryAction } from "./homepage"

export interface SitePromoCode {
  id: string
  code: string
  amount: string
  desc: string
  emoji: string
  colorBg: string
}

export interface SiteHeroProps {
  config: SiteHeroConfig
  promos: SitePromoCode[]
  configured?: boolean
  onBooking: () => void
  onCall: () => void
  onNavigate: (sectionId: string) => void
  onPromoCopied?: (promo: SitePromoCode) => void
}

/** Faithful port of attached components/sections/Hero.tsx with CMS props. */
export function SiteHero({ config, onBooking, onCall, onNavigate, onPromoCopied, promos }: SiteHeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const bookingRef = useRef<HTMLDivElement>(null)
  const slides = config.slides

  useEffect(() => {
    if (slides.length < 2 || config.autoplayMs <= 0) return
    const timer = window.setInterval(() => setCurrentSlide((value) => (value + 1) % slides.length), config.autoplayMs)
    return () => window.clearInterval(timer)
  }, [config.autoplayMs, slides.length])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!bookingRef.current?.contains(event.target as Node)) setBookingOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])

  const runAction = (action: SiteHeroCta) => {
    if (action.action === "booking") onBooking()
    else if (action.action === "call") onCall()
    else if (action.action === "navigate" && action.target) onNavigate(action.target.replace(/^\/?#/, ""))
    else if (action.action === "link" && action.target) window.location.assign(action.target)
  }

  const copyPromo = async (promo: SitePromoCode) => {
    try { await navigator.clipboard.writeText(promo.code) } catch { /* clipboard can be unavailable on insecure origins */ }
    setCopiedCode(promo.code)
    onPromoCopied?.(promo)
    window.setTimeout(() => setCopiedCode(null), 2200)
  }

  if (!config.enabled || !slides.length) return null
  const activeSlide = slides[currentSlide] ?? slides[0]!

  return (
    <section id="hero" data-section-key="hero" data-site-component="hero" className="w-full pt-0 lg:pt-6">
      <div className="relative rounded-t-none rounded-b-2xl lg:rounded-2xl overflow-hidden h-[460px] lg:h-[520px] img-dim bg-ink">
        {slides.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.image}
            alt={slide.imageAlt}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ${index === currentSlide ? "opacity-100 scale-[1.04]" : "opacity-0 scale-100"}`}
            style={{ objectPosition: slide.focalPoint ? `${slide.focalPoint.x}% ${slide.focalPoint.y}%` : undefined, transition: "opacity 1.2s, transform 6s linear" }}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}

        <div className="absolute inset-0 z-10 p-5 lg:p-10 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="site-hero__distance-badge chip on-img !h-9 !px-3.5 !text-[13px]">
              <MapPin size={13} className="text-green" />
              {config.badge}
            </span>
            <div className="flex gap-1.5 items-center">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Слайд ${index + 1}`}
                  className="h-1.5 rounded-full overflow-hidden transition-all duration-500 bg-white/45"
                  style={{ width: index === currentSlide ? 40 : 10 }}
                >
                  {index === currentSlide ? <span key={`${index}-${currentSlide}`} className="block h-full bg-white animate-[site-hero-grow_linear_forwards]" style={{ animationDuration: `${config.autoplayMs}ms` }} /> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7 flex flex-col gap-5 max-w-[640px]">
              <h1 className="text-white text-[32px] md:text-[44px] leading-[1.05] font-semibold tracking-[-1px] text-balance">{activeSlide.title || config.title}</h1>
              <p className="text-white/85 text-[14px] lg:text-[15px] max-w-[480px] hidden sm:block">{activeSlide.tagline}</p>
              <div className="site-hero__actions flex flex-nowrap gap-2.5">
                <div ref={bookingRef} className="relative min-w-0">
                  <button type="button" aria-label={typeof config.primaryCta.label === "string" ? config.primaryCta.label : "Забронировать"} onClick={() => config.primaryCta.action === "booking" ? setBookingOpen((value) => !value) : runAction(config.primaryCta)} className="site-hero__action btn btn-primary">
                    <span className="site-hero__action-label">{config.primaryCta.label}</span>
                    <CalendarDays className="site-hero__action-mobile-icon" aria-hidden="true" />
                    <span className="site-hero__action-trailing btn-arrow"><ChevronDown size={14} className={bookingOpen ? "rotate-180 transition-transform" : "transition-transform"} /></span>
                  </button>
                  {config.primaryCta.action === "booking" && bookingOpen ? (
                    <div className="dropdown-panel absolute left-0 bottom-[calc(100%+6px)] z-50 w-[240px] shadow-xl">
                      <button type="button" aria-label="ВКонтакте — написать" onClick={() => { setBookingOpen(false); onBooking() }} className="dropdown-item"><span className="icon-tile !w-7 !h-7 !rounded-[8px] text-green"><Send size={13} /></span>Написать ВКонтакте</button>
                      <button type="button" onClick={() => { setBookingOpen(false); onCall() }} className="dropdown-item"><span className="icon-tile !w-7 !h-7 !rounded-[8px]"><Phone size={13} /></span>Позвонить</button>
                    </div>
                  ) : null}
                </div>
                <SiteSecondaryAction onMedia onClick={() => runAction(config.secondaryCta)}>{config.secondaryCta.label}</SiteSecondaryAction>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex absolute right-8 bottom-8 z-20 flex-col gap-3 w-[300px]">
          {config.featureCards.slice(0, 2).map((card) => (
            <button key={card.id} type="button" onClick={() => card.href.startsWith("/#") ? onNavigate(card.href.slice(2)) : window.location.assign(card.href)} className="site-motion-spring group bg-surface rounded-xl p-2.5 flex items-center gap-3 text-left hover:-translate-x-1.5 transition-transform">
              <span className="card-img w-[64px] h-[64px] shrink-0 !rounded-[16px]"><img src={card.image} alt={card.imageAlt} loading="lazy" /></span>
              <span className="flex-1 flex flex-col gap-0.5 min-w-0"><span className="text-[15px] font-semibold tracking-[-0.4px] leading-tight text-ink">{card.title}</span><span className="text-[12px] text-ink-2 leading-tight">{card.description}</span></span>
              <span className="arrow-bubble mr-1"><ArrowRight size={16} /></span>
            </button>
          ))}
        </div>
      </div>

      <div id="promo" className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 scroll-mt-24">
        {promos.map((promo) => {
          const copied = copiedCode === promo.code
          return (
            <button key={promo.id} type="button" onClick={() => void copyPromo(promo)} aria-label={`Скопировать промокод ${promo.code}`} className="site-promo-card site-motion-spring bg-surface rounded-xl p-3 flex items-center gap-3 text-left hover:-translate-y-[3px] transition-transform">
              <span className="icon-tile !w-12 !h-12 text-[22px]" aria-hidden="true">{promo.emoji}</span>
              <span className="flex-1 min-w-0"><span className="site-promo-card__title block text-[22px] font-semibold tracking-[-0.8px] leading-none text-ink">{promo.amount}</span><span className="site-promo-card__description block text-[12px] text-ink-2 mt-1 truncate">{promo.desc}</span></span>
              <span className={`h-9 rounded-full pl-3 pr-1.5 inline-flex items-center gap-2 text-[12px] font-semibold shrink-0 ${copied ? "bg-green text-white" : "bg-green-soft text-green-deep"}`}>
                <Ticket size={13} /><span className="site-promo-card__code">{promo.code}</span><span className="w-6 h-6 rounded-full bg-white/70 text-green-deep inline-flex items-center justify-center">{copied ? <Check size={12} /> : <Copy size={12} />}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
