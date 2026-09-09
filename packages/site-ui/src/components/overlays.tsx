import { useEffect, useId, useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "../lib/cn"
import { IconButton } from "./primitives"

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  responsiveFullscreen?: boolean
  closeLabel?: string
}

export function Dialog({ children, className, closeLabel = "Закрыть", description, footer, onOpenChange, open, responsiveFullscreen = false, title }: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")
    focusables?.[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
      if (event.key !== "Tab" || !focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus()
    }
  }, [onOpenChange, open])

  if (!open) return null

  return (
    <div className="site-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false) }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={cn("site-dialog", responsiveFullscreen && "site-dialog--responsive", className)}>
        <header className="site-dialog__header">
          <div><h2 id={titleId} className="site-dialog__title">{title}</h2>{description ? <p id={descriptionId} className="site-dialog__description">{description}</p> : null}</div>
          <IconButton label={closeLabel} variant="ghost" onClick={() => onOpenChange(false)}><X size={18} /></IconButton>
        </header>
        <div className="site-dialog__body">{children}</div>
        {footer ? <footer className="site-dialog__footer">{footer}</footer> : null}
      </div>
    </div>
  )
}

export interface SheetProps extends Omit<DialogProps, "title"> {
  title?: ReactNode
  side?: "right" | "bottom"
}

export function Sheet({ children, closeLabel = "Закрыть", footer, onOpenChange, open, side = "right", title = "Панель" }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false) }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange, open])
  if (!open) return null
  return (
    <div className="site-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false) }}>
      <section className={side === "bottom" ? "site-drawer" : "site-sheet"} role="dialog" aria-modal="true">
        <header className="site-dialog__header"><h2 className="site-dialog__title">{title}</h2><IconButton label={closeLabel} variant="ghost" onClick={() => onOpenChange(false)}><X size={18} /></IconButton></header>
        <div className="site-dialog__body">{children}</div>
        {footer ? <footer className="site-dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  )
}

export const Drawer = Sheet
