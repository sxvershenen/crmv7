import { Link } from "react-router-dom"

import { PageFrame } from "@crm/ui"

import { hasAdminCapability, navGroups } from "@admin/app/navigation"
import { PageHeading } from "@admin/components/cms-ui"
import { useAdminAuthSession } from "@admin/features/auth-session-context"

export function MobileMenuPage() {
  const { user } = useAdminAuthSession()
  return <PageFrame>
    <PageHeading description="Разделы CMS, доступные текущей учётной записи." title="Меню" />
    <div className="space-y-4">{navGroups.map((group) => {
      const items = group.items.filter((item) => hasAdminCapability(user.capabilities, item.capability))
      return items.length ? <section key={group.label}><h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[.06em] text-muted-foreground">{group.label}</h2><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => <Link className="flex min-h-12 items-center gap-3 rounded-xl border bg-background px-3 text-xs font-medium hover:bg-muted/35" key={item.href} to={item.href}><item.icon aria-hidden="true" className="size-4 text-muted-foreground" />{item.label}</Link>)}</div></section> : null
    })}</div>
  </PageFrame>
}
