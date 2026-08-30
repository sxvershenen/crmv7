import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { EditorSaveStateIndicator, type EditorSaveState } from "./editor-save-state"

export function EditorFrame({ actions, children, className, footerActions, mobileActions, navigation, saveDetail, saveState, sidebar }: { actions?: ReactNode; children: ReactNode; className?: string; footerActions: ReactNode; mobileActions?: ReactNode; navigation: ReactNode; saveDetail?: string; saveState: EditorSaveState; sidebar: ReactNode }) {
  return <div className={cn("min-h-[calc(100vh-3.5rem)] bg-surface-sunken", className)} data-slot="editor-frame">
    <header className="sticky top-14 z-10 border-b bg-background/95 backdrop-blur" data-slot="editor-topbar"><div className="relative flex min-h-10 items-center gap-2 overflow-hidden px-3 sm:px-5"><div className="min-w-0 flex-1 overflow-hidden pr-11 md:pr-0">{navigation}</div>{actions ? <div className="hidden shrink-0 items-center gap-1 md:flex" data-slot="editor-desktop-actions">{actions}</div> : null}{mobileActions ? <><div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-r from-transparent via-background/90 to-background md:hidden" data-slot="editor-nav-fade" /><div className="absolute inset-y-0 right-3 z-10 flex items-center bg-background/95 pl-1 md:hidden" data-slot="editor-mobile-actions">{mobileActions}</div></> : null}</div></header>
    <div className="grid items-start gap-3 px-3 py-3 pb-20 sm:px-5 sm:py-4 sm:pb-20 xl:grid-cols-[minmax(0,1fr)_320px] xl:px-6" data-slot="editor-workspace"><main className="min-w-0">{children}</main><aside className="min-w-0" data-slot="editor-sidebar">{sidebar}</aside></div>
    <footer className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center justify-between gap-3 border-t bg-background/95 px-3 py-2 backdrop-blur sm:px-5 lg:bottom-0 lg:left-60" data-slot="editor-actionbar"><EditorSaveStateIndicator {...(saveDetail ? { detail: saveDetail } : {})} state={saveState} /><div className="flex shrink-0 items-center gap-2">{footerActions}</div></footer>
  </div>
}

export function EditorSection({ actions, children, className, subtitle, title }: { actions?: ReactNode; children: ReactNode; className?: string; subtitle?: string; title: string }) {
  return <section className={cn("overflow-hidden rounded-xl border bg-background", className)} data-slot="editor-section"><header className="flex min-h-12 items-center gap-3 border-b px-4 py-2.5"><div className="min-w-0 flex-1"><h2 className="truncate text-[13px] font-semibold leading-5">{title}</h2>{subtitle ? <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{subtitle}</p> : null}</div>{actions ? <div className="shrink-0">{actions}</div> : null}</header><div className="p-4">{children}</div></section>
}
