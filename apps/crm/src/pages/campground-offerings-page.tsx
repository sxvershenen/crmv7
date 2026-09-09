import { useMemo } from "react"
import { IconSearch, IconTent } from "@tabler/icons-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import { CampgroundOfferingList, type OfferingEditorGateway } from "@crm/offering-editor"
import { FormField, Input, PageFrame } from "@crm/ui"

import { houseOfferingGateway } from "@app/data/house-offerings-repository"

export function CampgroundOfferingsPage({ gateway = houseOfferingGateway }: { gateway?: OfferingEditorGateway }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const q = params.get("q") ?? ""
  const query = useMemo(() => q.trim() ? { q: q.trim() } : {}, [q])

  return <PageFrame className="space-y-3" width="wide">
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><IconTent aria-hidden="true" className="size-5 text-primary" /><h1 className="text-base font-semibold">Предложения кемпингов</h1></div>
        <p className="mt-1 text-xs text-muted-foreground">Отдельные наши палатки и места в общей зоне гостевых палаток.</p>
      </div>
      <FormField className="w-full sm:w-80" htmlFor="campground-offering-search" label="Поиск">
        <div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" id="campground-offering-search" onChange={(event) => setParams((current) => { const next = new URLSearchParams(current); if (event.target.value) next.set("q", event.target.value); else next.delete("q"); return next }, { replace: true })} placeholder="Название или код" value={q} /></div>
      </FormField>
    </section>
    <CampgroundOfferingList gateway={gateway} onOpenOffering={(offering) => navigate(`/offers/campgrounds/${offering.id}`, { state: { from: `${location.pathname}${location.search}` } })} query={query} />
  </PageFrame>
}
