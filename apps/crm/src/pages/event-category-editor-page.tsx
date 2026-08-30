import { CategoryEditor } from "@app/components/shared/category-editor"
import { formatEventDateTime } from "@app/components/events/event-format"
import { EventIcon } from "@app/components/events/event-presentation"
import { eventIconOptions, eventToneOptions } from "@app/components/events/event-presentation-data"
import { createEmptyEventCategory, eventsRepository, type EventCategoryEditorRepository } from "@app/data/events-repository"
import type { EventCategoryEditorRecord } from "@app/entities/events"

const renderIcon = (category: EventCategoryEditorRecord, size: "sm" | "md" = "sm") => <EventIcon icon={category.icon} size={size} tone={category.tone} />
const relatedItems = (category: EventCategoryEditorRecord) => category.relatedEvents.map((event) => ({ href: `/events/${event.id}`, id: event.id, label: event.name, secondary: `${formatEventDateTime(event.startsAt)} · ${event.clientName}` }))

export function EventCategoryEditorPage({ repository = eventsRepository }: { repository?: EventCategoryEditorRepository }) {
  return <CategoryEditor createEmpty={createEmptyEventCategory} entityLabel="Категория мероприятий" iconOptions={eventIconOptions} listPath="/events/categories" relatedItems={relatedItems} relatedLabel="Мероприятия" renderIcon={renderIcon} repository={repository} tone="event" toneOptions={eventToneOptions} usageCount={(category) => category.eventCount} usageLabel="Мероприятий" />
}
