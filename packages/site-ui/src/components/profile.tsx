import { ArrowRight } from "lucide-react"
import { Badge, Button, Card, SectionHeading, Stack } from "./primitives"

export interface PublicProfileIntroProps {
  kindLabel: string
  title: string
  summary?: string | null
  bookingLabel?: string
  bookingItem?: string
}

/** Safe CMS-first profile fallback; operational availability and prices are never inferred here. */
export function PublicProfileIntro({ bookingItem, bookingLabel = "Оставить заявку", kindLabel, summary, title }: PublicProfileIntroProps) {
  return <section className="site-section site-section--compact"><Card className="site-profile-intro"><Stack gap="var(--site-space-5)"><Badge tone="brand">{kindLabel}</Badge><SectionHeading level={1} title={title} description={summary} /><div><Button type="button" data-site-action="booking" data-site-item={bookingItem ?? title}>{bookingLabel}<ArrowRight size={16} /></Button></div></Stack></Card></section>
}
