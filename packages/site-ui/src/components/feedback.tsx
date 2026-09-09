import { AlertCircle, CheckCircle2, Inbox, X } from "lucide-react"
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "../lib/cn"
import { Button, IconButton } from "./primitives"

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("site-skeleton", className)} {...props} />
}

export interface StatePanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}

export function StatePanel({ action, children, className, description, icon, title, ...props }: StatePanelProps) {
  return <div className={cn("site-state", className)} {...props}><div>{icon}<h3 className="site-state__title">{title}</h3>{description ? <p className="site-state__description">{description}</p> : null}{children}{action ? <div style={{ marginTop: "var(--site-space-4)" }}>{action}</div> : null}</div></div>
}

export function EmptyState(props: Omit<StatePanelProps, "icon">) { return <StatePanel icon={<Inbox size={28} aria-hidden="true" />} {...props} /> }
export function ErrorState({ retry, ...props }: Omit<StatePanelProps, "icon" | "action"> & { retry?: () => void }) { return <StatePanel role="alert" icon={<AlertCircle size={28} aria-hidden="true" />} action={retry ? <Button variant="outline" onClick={retry}>Повторить</Button> : undefined} {...props} /> }

export function Alert({ children, className, tone = "neutral" }: { children: ReactNode; className?: string; tone?: "neutral" | "error" | "success" }) {
  return <div className={cn("site-alert", tone !== "neutral" && `site-alert--${tone}`, className)} role={tone === "error" ? "alert" : "status"}>{tone === "success" ? <CheckCircle2 size={18} /> : tone === "error" ? <AlertCircle size={18} /> : null}<div>{children}</div></div>
}

export interface ToastItem { id: string; title: ReactNode; description?: ReactNode; tone?: "neutral" | "success" | "error" }

export function Toast({ item, onDismiss }: { item: ToastItem; onDismiss?: ((id: string) => void) | undefined }) {
  return <div className="site-toast" role={item.tone === "error" ? "alert" : "status"}><div><strong>{item.title}</strong>{item.description ? <div>{item.description}</div> : null}</div>{onDismiss ? <IconButton label="Закрыть" size="sm" variant="ghost" onClick={() => onDismiss(item.id)}><X size={16} /></IconButton> : null}</div>
}

export function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss?: ((id: string) => void) | undefined }) {
  return <div className="site-toast-viewport" aria-live="polite">{items.map((item) => <Toast key={item.id} item={item} onDismiss={onDismiss} />)}</div>
}

/** Compact global acknowledgement used by the restored public shell. */
export function CompactToast({ message, onClose }: { message: ReactNode | null; onClose: () => void }) {
  if (!message) return null
  return <div className="fixed top-6 right-6 z-[120] animate-in fade-in slide-in-from-top-4 duration-[var(--site-motion-card)]" role="status" aria-live="polite"><div className="flex items-center gap-2.5 px-4 py-3 rounded-[var(--site-radius-md)] bg-[var(--site-color-text)] text-[var(--site-color-text-inverse)] text-[length:var(--site-text-body-sm)] font-[var(--site-weight-medium)] shadow-[var(--site-shadow-xl)]"><CheckCircle2 className="w-4 h-4 text-[var(--site-color-brand-500)]" /><span>{message}</span><button type="button" onClick={onClose} aria-label="Закрыть уведомление" className="sr-only focus:not-sr-only focus:absolute focus:right-2 focus:rounded-[var(--site-radius-round)] focus:p-1 focus:hover:bg-[var(--site-color-surface-inverse-soft)]"><X className="w-3.5 h-3.5" /></button></div></div>
}
