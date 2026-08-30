import { IconDotsVertical, IconPlus } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import { ActionableCard, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, IconButton } from "@crm/ui"
import type { EventCategory } from "@app/entities/events"
import { EventIcon } from "./event-presentation"

export function EventCategoriesGrid({ categories }: { categories: EventCategory[] }) {
  const navigate = useNavigate()
  return <section aria-label="Категории мероприятий" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{categories.map((category) => <ActionableCard actions={<CategoryActions category={category} />} className="min-h-40" key={category.id} onOpen={() => navigate(`/events/categories/${category.id}`)} openLabel={`Открыть категорию ${category.name}`}><div className="flex items-start gap-3 pr-10"><EventIcon icon={category.icon} size="md" tone={category.tone} /><div className="min-w-0"><p className="text-sm font-medium">{category.name}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{category.description}</p></div></div><div className="mt-5 flex items-center justify-between border-t pt-3"><span className="text-[11px] text-muted-foreground">Мероприятий</span><span className="tabular-nums">{category.eventCount}</span></div></ActionableCard>)}</section>
}

export function CreateEventCategoryAction() { const navigate = useNavigate(); return <Button onClick={() => navigate("/events/categories/new")} size="sm"><IconPlus aria-hidden="true" />Новая категория</Button> }

function CategoryActions({ category }: { category: EventCategory }) {
  const navigate = useNavigate()
  return <DropdownMenu><DropdownMenuTrigger render={<IconButton label={`Действия категории ${category.name}`} size="icon-sm" variant="ghost"><IconDotsVertical aria-hidden="true" /></IconButton>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => navigate(`/events/categories/${category.id}`)}>Редактировать категорию</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
}
