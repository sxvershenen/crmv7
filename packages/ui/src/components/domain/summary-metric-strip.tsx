import { Children, type ReactNode, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export function SummaryMetricStrip({ ariaLabel, children, className }: { ariaLabel: string; children: ReactNode; className?: string }) {
  const count = Children.count(children)
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const updateActive = () => {
    const element = scroller.current
    if (!element) return
    const first = element.firstElementChild as HTMLElement | null
    const step = (first?.offsetWidth ?? element.clientWidth) + 8
    setActive(Math.min(count - 1, Math.max(0, Math.round(element.scrollLeft / step))))
  }

  return <section aria-label={ariaLabel} className={className} data-slot="summary-metric-strip">
    <div className="relative">
      <div className={cn("flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[calc(100%-2rem)] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 sm:[&>*]:w-auto lg:grid-cols-4 2xl:grid-cols-7")} onScroll={updateActive} ref={scroller}>{children}</div>
      <div aria-hidden="true" className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground sm:hidden"><span>Листайте показатели</span><span className="tabular-nums">{active + 1} / {count}</span></div>
    </div>
  </section>
}
