import { forwardRef, type HTMLAttributes, type ReactNode } from "react"
import { ArrowRight, ArrowUpRight, Calendar, Check, ChevronDown, Clock, Plus, Users } from "lucide-react"
import { cn } from "../lib/cn"

export interface SiteSectionHeaderProps {
  eyebrow?: ReactNode
  eyebrowIcon?: ReactNode
  title: ReactNode
  description?: ReactNode
  eyebrowTone?: "surface" | "brand"
  className?: string
  titleId?: string
}

/**
 * Pixel contract for the restored homepage section heading. Keep this
 * composition in the kit so generated/CMS sections cannot fork its spacing,
 * typography or responsive description alignment.
 */
export function SiteSectionHeader({
  className,
  description,
  eyebrow,
  eyebrowIcon,
  eyebrowTone = "brand",
  title,
  titleId,
}: SiteSectionHeaderProps) {
  return <div data-site-component="section-heading" className={cn("site-home-heading", className)}>
    {eyebrow ? <div className={cn("site-home-heading__eyebrow", `site-home-heading__eyebrow--${eyebrowTone}`)}>{eyebrowIcon ? <span className="eyebrow-ico">{eyebrowIcon}</span> : null}{eyebrow}</div> : null}
    <div className="site-home-heading__row">
      <h2 id={titleId} className="site-home-heading__title">{title}</h2>
      {description ? <p className="site-home-heading__description">{description}</p> : null}
    </div>
  </div>
}

export interface SiteActionSectionHeaderProps extends SiteSectionHeaderProps {
  action: ReactNode
}

export function SiteSecondaryAction({ analyticsId, children, href, mobileIcon, onClick, onMedia = false }: { analyticsId?: string; children: ReactNode; href?: string; mobileIcon?: ReactNode; onClick?: () => void; onMedia?: boolean }) {
  const className = cn("site-secondary-action btn", onMedia ? "btn-white-on-img" : "btn-light")
  const content = <><span className={mobileIcon ? "site-secondary-action__label" : undefined}>{children}</span>{mobileIcon ? <span className="site-secondary-action__mobile">{mobileIcon}</span> : null}<span className="site-secondary-action__arrow btn-arrow"><ArrowRight size={15} /></span></>
  return href ? <a href={href} className={className} data-analytics-id={analyticsId}>{content}</a> : <button type="button" onClick={onClick} className={className} data-analytics-id={analyticsId}>{content}</button>
}

export function SiteActionSectionHeader({ action, className, description, eyebrow, eyebrowIcon, eyebrowTone = "brand", title, titleId }: SiteActionSectionHeaderProps) {
  return <div data-site-component="action-heading" className={cn("site-home-heading site-home-heading--action", className)}>{eyebrow ? <div className={cn("site-home-heading__eyebrow", `site-home-heading__eyebrow--${eyebrowTone}`)}>{eyebrowIcon ? <span className="eyebrow-ico">{eyebrowIcon}</span> : null}{eyebrow}</div> : null}<div className="site-home-heading__action-row">{description ? <div className="site-home-heading__action-copy"><h2 id={titleId} className="site-home-heading__title">{title}</h2><p className="site-home-heading__description">{description}</p></div> : <h2 id={titleId} className="site-home-heading__title min-w-0">{title}</h2>}{action}</div></div>
}

export interface SiteFilterOption {
  id: string
  label: ReactNode
  selected: boolean
  onSelect: () => void
}

export interface SiteFilterMenuProps {
  label: ReactNode
  icon?: ReactNode
  open: boolean
  onToggle: () => void
  options: SiteFilterOption[]
  width?: "sm" | "md"
}

export function SiteFilterMenu({ icon, label, onToggle, open, options, width = "sm" }: SiteFilterMenuProps) {
  return <div className="relative z-40 shrink-0"><button type="button" aria-expanded={open} aria-haspopup="true" aria-label={typeof label === "string" ? label : undefined} onClick={onToggle} className="h-[var(--site-control-md)] px-4 rounded-[var(--site-radius-round)] bg-[var(--site-color-surface)] text-[var(--site-color-text)] text-[length:var(--site-text-body-sm)] font-[var(--site-weight-medium)] inline-flex items-center gap-2 hover:bg-[var(--site-color-surface-muted)] transition-colors">{icon}<span className="hidden sm:inline">{label}</span><ChevronDown className={cn("w-3.5 h-3.5 text-[var(--site-color-text-disabled)] transition-transform", open && "rotate-180")} /></button>{open ? <div className={cn("absolute right-0 top-[46px] bg-[var(--site-color-surface)] rounded-[var(--site-radius-md)] p-2 border border-[var(--site-color-border)] shadow-[var(--site-shadow-xl)] z-40 animate-in fade-in zoom-in-95 duration-[var(--site-motion-popover)]", width === "md" ? "w-52" : "w-48")}>{options.map((option) => <button type="button" aria-pressed={option.selected} key={option.id} onClick={option.onSelect} className={cn("w-full text-left p-2 rounded-[var(--site-radius-sm)] text-[length:var(--site-text-caption)] font-[var(--site-weight-medium)] transition-colors", option.selected ? "bg-[var(--site-color-bg)] text-[var(--site-color-brand-500)]" : "text-[var(--site-color-text)] hover:bg-[var(--site-color-bg)]")}>{option.label}</button>)}</div> : null}</div>
}

export interface SiteMetaChipProps {
  children: ReactNode
  icon?: ReactNode
  className?: string
}

export function SiteMetaChip({ children, className, icon }: SiteMetaChipProps) {
  return <span className={cn("chip !h-6 !text-[11px]", className)}>{icon}{children}</span>
}

export interface SitePriceActionProps {
  price: ReactNode
  action: ReactNode
  label?: ReactNode
  className?: string
}

export function SitePriceAction({ action, className, label = "стоимость от", price }: SitePriceActionProps) {
  return <div className={cn("pt-3 border-t border-[var(--site-color-divider)] flex items-center justify-between px-1.5", className)}><div><div className="text-[length:var(--site-text-eyebrow)] font-[var(--site-weight-medium)] text-[var(--site-color-text-muted)] tracking-normal">{label}</div><div className="text-[length:var(--site-text-price)] font-[var(--site-weight-semibold)] text-[var(--site-color-brand-500)] tracking-[var(--site-tracking-title)]">{price}</div></div>{action}</div>
}

export function SiteFooterShell({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("bg-footer text-footer-ink mt-[var(--section-gap)] pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] lg:pb-0", className)} {...props}><div className="container-x pt-12 lg:pt-16 pb-8">{children}</div></footer>
}

export function SiteFooterBrand({ description, mark = "С", subtitle, title }: { mark?: ReactNode; title: ReactNode; subtitle: ReactNode; description: ReactNode }) {
  return <div className="flex flex-col gap-5"><a href="#hero" className="flex items-center gap-3 w-fit group"><span className="w-10 h-10 rounded-sm bg-green text-white inline-flex items-center justify-center group-hover:-rotate-[8deg] transition-transform">{mark}</span><span><span className="block text-[17px] font-semibold tracking-[-.5px]">{title}</span><span className="block text-[11px] text-footer-ink-2 mt-0.5">{subtitle}</span></span></a><p className="text-[13px] text-footer-ink-2 max-w-[320px]">{description}</p></div>
}

export function SiteFooterColumn({ children, title, tone = "quiet" }: { title: ReactNode; children: ReactNode; tone?: "quiet" | "subtle" }) {
  return <div className="rounded-md bg-white/5 lg:bg-transparent p-3 lg:p-0"><h3 className="h-10 lg:h-auto lg:mb-4 text-[13px] font-semibold uppercase">{title}</h3><ul className={cn("flex flex-col gap-2.5 text-[13px]", tone === "subtle" ? "text-footer-ink" : "text-footer-ink-2")}>{children}</ul></div>
}

export function SiteFooterLegal({ children }: { children: ReactNode }) {
  return <div className="mt-10 lg:mt-14 pt-6 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 text-[12px] text-footer-ink-2 border-t border-white/10">{children}</div>
}

export interface SiteResponsiveRailProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "events" | "two-column" | "venues"
}

export const SiteResponsiveRail = forwardRef<HTMLDivElement, SiteResponsiveRailProps>(function SiteResponsiveRail({ children, className, variant = "two-column", ...props }, ref) {
  const layout = variant === "events"
    ? "lg:grid lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0"
    : variant === "venues"
      ? "lg:grid lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0"
      : "lg:grid lg:grid-cols-2 gap-4 lg:overflow-visible lg:pb-0 lg:mx-0 lg:px-0"
  return <div ref={ref} data-site-component="responsive-rail" className={cn("flex gap-3 overflow-x-auto overscroll-x-contain scroll-smooth [-webkit-overflow-scrolling:touch] snap-x snap-mandatory scroll-px-[var(--content-pad)] no-scrollbar -mx-[var(--content-pad)] px-[var(--content-pad)] [&>*]:shrink-0 [&>*]:snap-start [&>*]:w-[min(23.75rem,calc(100vw-6rem))] lg:[&>*]:w-auto lg:[&>*]:min-w-0", layout, className)} {...props}>{children}</div>
})

export interface SiteEventFeatureCardProps {
  image: string
  title: ReactNode
  description: ReactNode
  dayMonth: ReactNode
  seatsLeft: ReactNode
  onSelect: () => void
}

export function SiteEventFeatureCard({ dayMonth, description, image, onSelect, seatsLeft, title }: SiteEventFeatureCardProps) {
  const [day, ...monthParts] = String(dayMonth).trim().split(/\s+/)
  const month = monthParts.join(" ").replace(/[^А-Яа-яЁё]/g, "").slice(0, 3).toLocaleUpperCase("ru-RU")
  void seatsLeft
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} className="card group/card flex flex-col cursor-pointer hover:-translate-y-1 transition-transform"><div className="card-img aspect-square"><img src={image} alt={typeof title === "string" ? title : ""} loading="lazy" /><span className="absolute left-3 top-3 z-10 bg-surface rounded-md px-3 py-2 flex flex-col leading-none"><span data-event-day className="text-[26px] font-semibold tracking-[-1px]">{day}</span><span data-event-month className="text-[11px] text-ink-2 uppercase mt-1">{month}</span></span><span className="arrow-bubble absolute right-3 top-3 z-10"><ArrowRight size={16} /></span></div><div className="px-2 pt-4 pb-2 flex flex-col gap-1.5"><h3 className="text-[18px] leading-[1.25] font-semibold tracking-[-.5px]">{title}</h3><p className="text-[13px] leading-[1.5] text-ink-2">{description}</p></div></div>
}

export interface SiteVenueCardProps {
  image: string
  title: string
  area: ReactNode
  capacity: ReactNode
  description: ReactNode
  tags: ReactNode[]
  onSelect: () => void
}

export function SiteVenueCard({ area, capacity, description, image, onSelect, tags, title }: SiteVenueCardProps) {
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} className="card group/card flex flex-col cursor-pointer hover:-translate-y-1 transition-transform"><div className="card-img aspect-[5/4]"><img src={image} alt={title} loading="lazy" /><span className="arrow-bubble absolute right-3 top-3 z-10 !w-9 !h-9"><ArrowUpRight size={15} /></span></div><div className="px-2 pt-3.5 pb-2 flex flex-col gap-2 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="text-[16px] leading-[1.25] font-semibold tracking-[-.5px]">{title}</h3><SiteMetaChip className="!bg-bg !text-ink" icon={<Users size={12} className="text-green" />}>{capacity}</SiteMetaChip></div><p className="text-[13px] leading-[1.5] text-ink-2">{description}</p><div className="flex flex-wrap gap-1.5 mt-auto pt-1">{tags.map((tag, index) => <span key={index} className="chip !h-6 !text-[11px]">{tag}</span>)}<span className="chip !h-6 !text-[11px]">{area}</span></div></div></div>
}

export interface SiteProgramFeatureCardProps {
  image: string
  imageAlt?: string
  title: ReactNode
  description: ReactNode
  age: ReactNode
  season: ReactNode
  duration: ReactNode
  onSelect: () => void
}

export function SiteProgramFeatureCard({ age, description, duration, image, imageAlt, onSelect, season, title }: SiteProgramFeatureCardProps) {
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} className="card group/card flex items-center gap-3 lg:gap-4 cursor-pointer hover:translate-x-1 transition-transform"><span className="card-img w-[84px] h-[84px] lg:w-[96px] lg:h-[96px] shrink-0 !rounded-[16px]"><img src={image} alt={imageAlt ?? (typeof title === "string" ? title : "")} loading="lazy" /></span><span className="flex-1 min-w-0 flex flex-col gap-1.5 py-1"><span className="text-[15px] lg:text-[16px] font-semibold tracking-[-.4px] leading-tight">{title}</span><span className="site-program-card__description text-[12px] lg:text-[13px] text-ink-2 line-clamp-1">{description}</span><span className="site-program-card__badges flex flex-nowrap sm:flex-wrap gap-1.5 mt-0.5 overflow-hidden"><SiteMetaChip icon={<Users size={11} className="text-ink-3" />}>{age}</SiteMetaChip><SiteMetaChip icon={<Calendar size={11} className="text-ink-3" />}>{season}</SiteMetaChip><SiteMetaChip className="hidden sm:inline-flex" icon={<Clock size={11} className="text-ink-3" />}>{duration}</SiteMetaChip></span></span><span className="arrow-bubble mr-1 hidden sm:inline-flex"><ArrowRight size={16} /></span></div>
}

export interface SiteResourceFeatureCardProps {
  media: ReactNode
  title: ReactNode
  capacity: ReactNode
  description: ReactNode
  perks: Array<{ icon: ReactNode; text: ReactNode }>
  price: ReactNode
  onSelect: () => void
}

export function SiteResourceFeatureCard({ capacity, description, media, onSelect, perks, price, title }: SiteResourceFeatureCardProps) {
  const action = <span className="btn btn-soft group-hover/card:bg-green-soft group-hover/card:text-green-deep"><span>Подробнее</span><span className="btn-arrow"><ArrowRight size={15} /></span></span>
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} className="card group/card flex flex-col cursor-pointer hover:-translate-y-1 transition-transform"><div>{media}<div className="px-2 pt-4 pb-2 flex flex-col gap-3"><div className="flex items-center justify-between gap-3"><h3 className="text-[20px] leading-[1.2] font-semibold tracking-[-.5px]">{title}</h3><SiteMetaChip className="!h-7 !px-2.5 !bg-bg !text-ink" icon={<Users size={12} className="text-green" />}>{capacity}</SiteMetaChip></div><p className="text-[13px] leading-[1.5] text-ink-2">{description}</p><div className="flex flex-wrap gap-1.5">{perks.map((perk, index) => <span key={index} className="chip"><span>{perk.icon}</span><span>{perk.text}</span></span>)}</div><div className="mt-auto pt-2 flex items-end justify-between gap-3"><div><div className="text-[11px] text-ink-3 mb-1">за ночь от</div><div className="text-[28px] leading-none font-semibold tracking-[-1px]">{price}</div></div>{action}</div></div></div></div>
}

export interface SiteSpaFeatureCardProps {
  media: ReactNode
  title: ReactNode
  description: ReactNode
  /** @deprecated Retained only so older consumers compile; SPA tabs are no longer rendered. */
  tabs?: Array<{ id: string; label: ReactNode }>
  /** @deprecated SPA tabs are no longer rendered. */
  activeTab?: string
  /** @deprecated SPA tabs are no longer rendered. */
  activeContent?: ReactNode
  price: ReactNode
  added: boolean
  onSelect: () => void
  /** @deprecated SPA tabs are no longer rendered. */
  onTabChange?: (id: string) => void
  onAdd: () => void
}

export function SiteSpaFeatureCard({ added, description, media, onAdd, onSelect, price, title }: SiteSpaFeatureCardProps) {
  const action = <button type="button" onClick={(event) => { event.stopPropagation(); onAdd() }} className={cn("btn", added ? "btn-primary" : "btn-soft")}><span>{added ? "Добавлено" : "Добавить"}</span><span className={cn("btn-arrow", !added && "plus")}>{added ? <Check size={14} /> : <Plus size={15} />}</span></button>
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} data-site-component="spa-card" className="card group/card flex flex-col cursor-pointer hover:-translate-y-1 transition-transform duration-[var(--site-motion-normal)] ease-[var(--site-ease)]"><div>{media}<div className="px-2 pt-4 pb-2 flex flex-col gap-3"><h3 className="text-[20px] leading-[1.2] font-semibold tracking-[-.5px]">{title}</h3><div className="site-spa-card__content min-h-[84px] rounded-[var(--site-radius-lg)] bg-bg px-4 py-3 text-[13px] leading-[1.5] text-ink-2">{description}</div><div className="mt-auto pt-2 flex items-end justify-between gap-3"><div><div className="text-[11px] text-ink-3 mb-1">за час от</div><div className="text-[28px] leading-none font-semibold tracking-[-1px]">{price}</div></div>{action}</div></div></div></div>
}

export interface SiteImageCategoryCardProps {
  image: string
  title: ReactNode
  meta?: ReactNode
  selected?: boolean
  onSelect: () => void
}

export function SiteImageCategoryCard({ image, meta, onSelect, selected = false, title }: SiteImageCategoryCardProps) {
  return <div onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect() }} role="button" tabIndex={0} aria-pressed={selected} className={cn("site-motion-spring group relative rounded-xl overflow-hidden aspect-square text-left img-dim cursor-pointer hover:scale-[.985] transition-transform duration-300", selected && "outline outline-[3px] outline-green outline-offset-[-3px]")}><img src={image} alt={typeof title === "string" ? title : ""} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 z-10 p-4 flex flex-col justify-between"><span className={cn("arrow-bubble ml-auto max-sm:!w-8 max-sm:!h-8", selected && "!bg-green !text-white")}><ArrowRight size={14} /></span><span><span className="block text-white text-[17px] lg:text-[19px] font-semibold leading-[1.2]">{title}</span>{meta ? <span className="block text-white/80 text-[11px] mt-1">{meta}</span> : null}</span></div></div>
}
