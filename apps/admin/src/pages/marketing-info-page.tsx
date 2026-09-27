import { IconExternalLink } from "@tabler/icons-react"

import { PageFrame } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { crmAppBaseUrl } from "@admin/lib/crm-url"

export function MarketingInfoPage() {
  return <PageFrame>
    <PageHeading description="Промокоды и условия скидок управляются в CRM." title="Маркетинг" />
    <section className="rounded-xl border bg-background p-4 sm:p-6">
      <h3 className="text-sm font-semibold">Промокоды</h3>
      <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">Создание промокодов, сроки действия и правила скидки находятся в CRM. Отдельный редактор кампаний в CMS пока не подключён.</p>
      <a className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2" href={`${crmAppBaseUrl}/marketing?tab=promotions`}><IconExternalLink className="size-4" />Открыть промокоды в CRM</a>
    </section>
  </PageFrame>
}
