import type { CSSProperties, ReactNode } from "react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { type AnalyticsProps } from "../lib/analytics"
import { cn } from "../lib/cn"
import { Badge, Card, IconBox, SiteLink } from "./primitives"
import { ResponsiveMedia, type ResponsiveMediaProps } from "./media"

export interface CategoryCardProps extends AnalyticsProps {
  href: string
  title: ReactNode
  description?: ReactNode
  icon: ReactNode
  color?: string
  background?: string
  count?: ReactNode
}

export function CategoryCard({ analyticsId, background, color, count, description, href, icon, title }: CategoryCardProps) {
  return <SiteLink href={href} analyticsAction="navigate" analyticsId={analyticsId} style={{ color: "inherit", textDecoration: "none" }}><Card interactive className="site-resource-card"><IconBox color={color} background={background}>{icon}</IconBox><div className="site-resource-card__body"><h3 className="site-resource-card__title">{title}</h3>{description ? <p className="site-resource-card__description">{description}</p> : null}{count ? <Badge style={{ marginTop: "var(--site-space-3)" }}>{count}</Badge> : null}</div></Card></SiteLink>
}

export interface ArticleCardProps extends AnalyticsProps {
  href: string
  title: ReactNode
  description?: ReactNode
  category?: ReactNode
  date?: ReactNode
  media?: ResponsiveMediaProps
  compact?: boolean
}

export function ArticleCard({ analyticsId, compact, date, description, href, media, title }: ArticleCardProps) {
  const row = compact || !media

  return <SiteLink
    href={href}
    analyticsAction="navigate"
    analyticsId={analyticsId}
    className={cn("site-article-card-link", row && "site-article-card-link--compact")}
    aria-label={typeof title === "string" ? title : undefined}
  >
    <article className={cn("site-article-card", row && "site-article-card--compact")}>
      {!row && media ? <div className="site-article-card__media">
        <ResponsiveMedia {...media} />
        <span className="site-article-card__media-action" aria-hidden="true"><ArrowUpRight /></span>
      </div> : null}
      <div className="site-article-card__body">
        <h3 className="site-article-card__title">{title}</h3>
        {description ? <p className="site-article-card__description">{description}</p> : null}
        {date ? <div className="site-article-card__date">{date}</div> : null}
      </div>
      {row ? <span className="site-article-card__row-action" aria-hidden="true"><ArrowRight /></span> : null}
    </article>
  </SiteLink>
}

export interface CatalogCardProps extends AnalyticsProps {
  href: string
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  media?: ResponsiveMediaProps
  attributes?: ReactNode[]
  priceLabel?: ReactNode
  price?: ReactNode
}

export function CatalogCard({ analyticsId, attributes = [], description, eyebrow, href, media, price, priceLabel = "от", title }: CatalogCardProps) {
  return <SiteLink href={href} analyticsAction="navigate" analyticsId={analyticsId} style={{ color: "inherit", textDecoration: "none" }}><Card interactive className="site-resource-card">{media ? <ResponsiveMedia {...media} /> : null}<div className="site-resource-card__body">{eyebrow ? <Badge tone="brand">{eyebrow}</Badge> : null}<h3 className="site-resource-card__title" style={{ marginTop: eyebrow ? "var(--site-space-3)" : undefined }}>{title}</h3>{description ? <p className="site-resource-card__description">{description}</p> : null}{attributes.length ? <ul className="site-feature-list">{attributes.map((attribute, index) => <li key={index}>{attribute}</li>)}</ul> : null}</div>{price ? <div className="site-resource-card__footer"><div><div className="site-price__label">{priceLabel}</div><div className="site-price__value">{price}</div></div></div> : null}</Card></SiteLink>
}

export interface SiteListingRailProps { children: ReactNode; columns?: number; label?: string; className?: string }
export function SiteListingRail({ children, className, columns = 4, label }: SiteListingRailProps) {
  return <div className={cn("site-rail", className)} role="region" aria-label={label} tabIndex={0} style={{ "--site-rail-cols": columns } as CSSProperties}>{children}</div>
}
