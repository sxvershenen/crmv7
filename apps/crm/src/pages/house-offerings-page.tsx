import { useMemo } from "react"
import { IconBuildingCottage, IconSearch } from "@tabler/icons-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { HouseOfferingList, type OfferingEditorGateway } from "@crm/offering-editor"
import { FormField, Input, PageFrame } from "@crm/ui"

import { houseOfferingGateway } from "@app/data/house-offerings-repository"

export function HouseOfferingsPage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const q = params.get("q") ?? ""
  const query = useMemo(() => q.trim() ? { q: q.trim() } : {}, [q])

  return <PageFrame className="space-y-3" width="wide">
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><IconBuildingCottage aria-hidden="true" className="size-5 text-primary" /><h1 className="text-base font-semibold">Предложения домиков</h1></div>
        <p className="mt-1 text-xs text-muted-foreground">Один operational catalog и прайс-листы для CRM и CMS.</p>
      </div>
      <FormField className="w-full sm:w-80" htmlFor="house-offering-search" label="Поиск">
        <div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" id="house-offering-search" onChange={(event) => setParams((current) => { const next = new URLSearchParams(current); if (event.target.value) next.set("q", event.target.value); else next.delete("q"); return next }, { replace: true })} placeholder="Название или код" value={q} /></div>
      </FormField>
    </section>
    <HouseOfferingList gateway={gateway} onOpenOffering={(offering) => navigate(`/offers/houses/${offering.id}`, { state: { from: `${location.pathname}${location.search}` } })} query={query} />
  </PageFrame>
}
