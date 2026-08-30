import { ResourceCard } from "@app/components/resources/resource-card"
import type { Resource } from "@app/entities/resources"

export function ResourcesGrid({ onBlock, onOpen, resources }: { onBlock: (resource: Resource) => void; onOpen: (resource: Resource) => void; resources: Resource[] }) {
  return (
    <section aria-label="Список ресурсов" className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3">
      {resources.map((resource) => <ResourceCard key={resource.id} onBlock={() => onBlock(resource)} onOpen={() => onOpen(resource)} resource={resource} />)}
    </section>
  )
}
