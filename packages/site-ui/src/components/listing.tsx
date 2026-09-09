import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import type { ReactNode, SelectHTMLAttributes } from "react"
import { cn } from "../lib/cn"
import { Button, Input, Select, SiteLink } from "./primitives"
import { ResponsiveMedia, type ResponsiveMediaProps } from "./media"

export interface FilterOption { value: string; label: string; disabled?: boolean }
export interface FilterDefinition { key: string; label: string; value?: string; options?: FilterOption[]; control?: "select" | "search" | "range"; placeholder?: string }
export interface ListingFilterBarProps {
  filters: FilterDefinition[]
  sort?: SelectHTMLAttributes<HTMLSelectElement> & { options: FilterOption[]; label?: string }
  onFilterChange?: (key: string, value: string) => void
  onReset?: () => void
  onApply?: () => void
  activeCount?: number
}

export function ListingFilterBar({ activeCount = 0, filters, onApply, onFilterChange, onReset, sort }: ListingFilterBarProps) {
  return <div className="site-filterbar" aria-label="Фильтры каталога"><span className="site-badge"><SlidersHorizontal size={13} />Фильтры{activeCount ? `: ${activeCount}` : ""}</span>{filters.map((filter) => <label className="site-field" key={filter.key}><span className="site-field__label">{filter.label}</span>{filter.control === "search" || filter.control === "range" ? <Input type={filter.control === "search" ? "search" : "text"} inputMode={filter.control === "range" ? "numeric" : undefined} placeholder={filter.placeholder} value={filter.value ?? ""} onChange={(event) => onFilterChange?.(filter.key, event.target.value)} /> : <Select value={filter.value ?? ""} onChange={(event) => onFilterChange?.(filter.key, event.target.value)}><option value="">Все</option>{filter.options?.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</Select>}</label>)}{sort ? <label className="site-field"><span className="site-field__label">{sort.label ?? "Сортировка"}</span><Select {...sort}>{sort.options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</Select></label> : null}{onApply ? <Button type="button" variant="primary" onClick={onApply}>Показать</Button> : null}{activeCount && onReset ? <Button type="button" variant="ghost" onClick={onReset}>Сбросить</Button> : null}</div>
}

export interface BreadcrumbItem { label: ReactNode; href?: string }
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return <nav className={cn("site-breadcrumbs", className)} aria-label="Хлебные крошки"><ol>{items.map((item, index) => <li key={index}>{item.href ? <SiteLink href={item.href}>{item.label}</SiteLink> : <span aria-current="page">{item.label}</span>}{index < items.length - 1 ? <span aria-hidden="true"> / </span> : null}</li>)}</ol></nav>
}

export function Pagination({ current, hrefForPage, onPageChange, total, variant = "default" }: { current: number; total: number; hrefForPage?: (page: number) => string; onPageChange?: (page: number) => void; variant?: "default" | "feature" }) {
  if (variant === "feature") return <nav data-site-component="pagination" className="flex items-center gap-1.5" aria-label="Пагинация"><button type="button" onClick={() => onPageChange?.(Math.max(1, current - 1))} disabled={current <= 1} className="arrow-bubble disabled:opacity-40 disabled:pointer-events-none" aria-label="Назад"><ChevronLeft size={16} /></button><ol className="contents">{Array.from({ length: total }, (_, index) => index + 1).map((page) => <li key={page}><button type="button" onClick={() => onPageChange?.(page)} aria-current={page === current ? "page" : undefined} className={cn("w-10 h-10 rounded-[var(--site-radius-round)] text-[length:var(--site-text-caption)] font-[var(--site-weight-medium)] transition-colors", page === current ? "bg-[var(--site-color-brand-500)] text-[var(--site-color-text-inverse)]" : "bg-[var(--site-color-surface)] text-[var(--site-color-text)] hover:bg-[var(--site-color-brand-50)]")}>{page}</button></li>)}</ol><button type="button" onClick={() => onPageChange?.(Math.min(total, current + 1))} disabled={current >= total} className="arrow-bubble disabled:opacity-40 disabled:pointer-events-none" aria-label="Вперёд"><ChevronRight size={16} /></button></nav>
  const pages = Array.from({ length: total }, (_, index) => index + 1).filter((page) => page === 1 || page === total || Math.abs(page - current) <= 1)
  const unique = [...new Set(pages)]
  const action = (page: number, label: ReactNode) => hrefForPage ? <SiteLink buttonVariant={page === current ? "primary" : "secondary"} buttonSize="sm" href={hrefForPage(page)} aria-current={page === current ? "page" : undefined}>{label}</SiteLink> : <Button type="button" size="sm" variant={page === current ? "primary" : "secondary"} onClick={() => onPageChange?.(page)} aria-current={page === current ? "page" : undefined}>{label}</Button>
  const edge = (page: number, label: string, icon: ReactNode, disabled: boolean) => hrefForPage && !disabled ? <SiteLink buttonVariant="secondary" buttonSize="sm" href={hrefForPage(page)} aria-label={label}>{icon}</SiteLink> : <Button type="button" size="sm" variant="secondary" disabled={disabled} aria-label={label} onClick={() => onPageChange?.(page)}>{icon}</Button>
  return <nav className="site-pagination" aria-label="Пагинация">{edge(current - 1, "Предыдущая страница", <ChevronLeft size={15} />, current <= 1)}{unique.map((page, index) => <span key={page}>{index > 0 && page - (unique[index - 1] ?? 0) > 1 ? <span aria-hidden="true">&hellip;</span> : null}{action(page, page)}</span>)}{edge(current + 1, "Следующая страница", <ChevronRight size={15} />, current >= total)}</nav>
}

export interface GalleryItem extends ResponsiveMediaProps { id: string }
export function Gallery({ items, className }: { items: GalleryItem[]; className?: string }) {
  return <div className={cn("site-gallery", className)}>{items.map(({ id, ...item }) => <ResponsiveMedia key={id} {...item} />)}</div>
}
