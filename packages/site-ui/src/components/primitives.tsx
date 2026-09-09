import {
  forwardRef,
  useId,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import { Plus } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"
import { analyticsAttributes, type AnalyticsProps } from "../lib/analytics"

const buttonVariants = cva("site-button", {
  variants: {
    variant: {
      primary: "site-button--primary",
      secondary: "site-button--secondary",
      muted: "site-button--muted",
      outline: "site-button--outline",
      ghost: "site-button--ghost",
      soft: "site-button--soft",
      inverse: "site-button--inverse",
      danger: "site-button--danger",
    },
    size: {
      sm: "site-button--sm",
      md: null,
      lg: "site-button--lg",
      icon: "site-button--icon",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
})

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants>,
    AnalyticsProps {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { analyticsAction, analyticsId, children, className, disabled, loading = false, size, variant, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ size, variant }), loading && "site-button--loading", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...analyticsAttributes({ analyticsAction, analyticsId })}
      {...props}
    >
      {children}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  label: string
  size?: "sm" | "md" | "lg"
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", ...props },
  ref,
) {
  return <Button ref={ref} size={size === "sm" ? "sm" : "icon"} aria-label={label} title={label} {...props} />
})

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  attached?: boolean
}

export function ButtonGroup({ attached = false, className, ...props }: ButtonGroupProps) {
  return <div className={cn("site-button-group", attached && "site-button-group--attached", className)} role="group" {...props} />
}

export interface SiteLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, AnalyticsProps {
  buttonVariant?: VariantProps<typeof buttonVariants>["variant"]
  buttonSize?: VariantProps<typeof buttonVariants>["size"]
}

export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(function SiteLink(
  { analyticsAction, analyticsId, buttonSize, buttonVariant, className, ...props },
  ref,
) {
  return (
    <a
      ref={ref}
      className={cn(buttonVariant ? buttonVariants({ size: buttonSize, variant: buttonVariant }) : "site-link", className)}
      {...analyticsAttributes({ analyticsAction, analyticsId })}
      {...props}
    />
  )
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info"
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return <span className={cn("site-badge", tone !== "neutral" && `site-badge--${tone}`, className)} {...props} />
}

export interface IconBoxProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string | undefined
  background?: string | undefined
  size?: string | undefined
}

export function IconBox({ background, className, color, size, style, ...props }: IconBoxProps) {
  const variables = {
    ...(color ? { "--site-icon-color": color } : {}),
    ...(background ? { "--site-icon-bg": background } : {}),
    ...(size ? { "--site-icon-size": size } : {}),
    ...style,
  } as CSSProperties
  return <span className={cn("site-icon-box", className)} style={variables} {...props} />
}

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "muted"
  bordered?: boolean
  raised?: boolean
}

export function Surface({ bordered, className, raised, tone = "default", ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        "site-surface",
        tone === "muted" && "site-surface--muted",
        bordered && "site-surface--bordered",
        raised && "site-surface--raised",
        className,
      )}
      {...props}
    />
  )
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "article" | "div" | "section"
  interactive?: boolean
}

export function Card({ as: Element = "article", className, interactive = false, ...props }: CardProps) {
  return <Element className={cn("site-card", interactive && "site-card--interactive", className)} {...props} />
}

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
}

export function Container({ className, size = "xl", ...props }: ContainerProps) {
  return <div className={cn("site-container", size !== "xl" && `site-container--${size}`, className)} {...props} />
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: string
}

export function Stack({ className, gap, style, ...props }: StackProps) {
  return <div className={cn("site-stack", className)} style={{ "--site-stack-gap": gap, ...style } as CSSProperties} {...props} />
}

export interface ClusterProps extends HTMLAttributes<HTMLDivElement> {
  gap?: string
}

export function Cluster({ className, gap, style, ...props }: ClusterProps) {
  return <div className={cn("site-cluster", className)} style={{ "--site-cluster-gap": gap, ...style } as CSSProperties} {...props} />
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: number
  desktopColumns?: number
  gap?: string
}

export function Grid({ className, columns, desktopColumns, gap, style, ...props }: GridProps) {
  return (
    <div
      className={cn("site-grid", className)}
      style={{
        ...(columns ? { "--site-grid-cols": columns } : {}),
        ...(desktopColumns ? { "--site-grid-cols-lg": desktopColumns } : {}),
        ...(gap ? { "--site-grid-gap": gap } : {}),
        ...style,
      } as CSSProperties}
      {...props}
    />
  )
}

export function Divider(props: HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={cn("site-divider", props.className)} />
}

const typographyVariants = cva("", {
  variants: {
    variant: {
      display: "site-type-display",
      h1: "site-type-h1",
      h2: "site-type-h2",
      h3: "site-type-h3",
      lead: "site-type-lead",
      body: "site-type-body",
      bodySm: "site-type-body-sm",
      caption: "site-type-caption",
      eyebrow: "site-type-eyebrow",
      price: "site-type-price",
    },
    tone: {
      default: "text-[var(--site-color-text)]",
      subtle: "text-[var(--site-color-text-subtle)]",
      muted: "text-[var(--site-color-text-muted)]",
      brand: "text-[var(--site-color-brand-500)]",
      inverse: "text-[var(--site-color-text-inverse)]",
    },
  },
  defaultVariants: { variant: "body", tone: "default" },
})

export interface TypographyProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof typographyVariants> {
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "small"
}

export function Typography({ as, className, tone, variant = "body", ...props }: TypographyProps) {
  const defaultElement = variant === "display" || variant === "h1" ? "h1" : variant === "h2" ? "h2" : variant === "h3" ? "h3" : variant === "caption" ? "small" : variant === "eyebrow" || variant === "price" ? "span" : "p"
  const Element = as ?? defaultElement
  return <Element className={cn(typographyVariants({ tone, variant }), className)} {...props} />
}

export interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  level?: 1 | 2 | 3
}

export function SectionHeading({ action, className, description, eyebrow, level = 2, title, ...props }: SectionHeadingProps) {
  const Heading = `h${level}` as "h1" | "h2" | "h3"
  return (
    <div className={cn("site-heading", className)} {...props}>
      {eyebrow ? (typeof eyebrow === "string" ? <Badge tone="brand">{eyebrow}</Badge> : eyebrow) : null}
      <div className="site-heading__row">
        <div>
          <Heading className="site-heading__title">{title}</Heading>
          {description ? <p className="site-heading__description">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  )
}

export interface FieldProps {
  children: ReactNode
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  id?: string
  className?: string
}

export function Field({ children, className, error, hint, id, label }: FieldProps) {
  return (
    <div className={cn("site-field", className)}>
      {label ? <label className="site-field__label" htmlFor={id}>{label}</label> : null}
      {children}
      {error ? <p className="site-field__error">{error}</p> : hint ? <p className="site-field__hint">{hint}</p> : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("site-input", className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("site-input", className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn("site-input", className)} {...props} />
})

type ChoiceProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }

function Choice({ className, label, type, ...props }: ChoiceProps) {
  return <label className={cn("site-choice", className)}><input type={type} {...props} /><span>{label}</span></label>
}

export function Checkbox(props: Omit<ChoiceProps, "type">) { return <Choice type="checkbox" {...props} /> }
export function Radio(props: Omit<ChoiceProps, "type">) { return <Choice type="radio" {...props} /> }

export function Switch({ className, id: providedId, label, ...props }: Omit<ChoiceProps, "type">) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  return (
    <label className={cn("site-switch", className)} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" {...props} />
      <span className="site-switch__track"><span className="site-switch__thumb" /></span>
      <span>{label}</span>
    </label>
  )
}

export interface TabsItem { id: string; label: ReactNode; content: ReactNode; disabled?: boolean }
export interface TabsProps { items: TabsItem[]; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; className?: string; renderPanel?: boolean }

export function Tabs({ className, defaultValue, items, onValueChange, renderPanel = true, value }: TabsProps) {
  const firstEnabled = items.find((item) => !item.disabled)?.id ?? ""
  const [localValue, setLocalValue] = useState(defaultValue ?? firstEnabled)
  const activeValue = value ?? localValue
  const active = items.find((item) => item.id === activeValue) ?? items.find((item) => !item.disabled)
  const select = (next: string) => { if (value === undefined) setLocalValue(next); onValueChange?.(next) }
  return (
    <div className={cn("site-tabs", className)}>
      <div className="site-tabs__list" role="tablist">
        {items.map((item) => (
          <button key={item.id} type="button" role="tab" className="site-tabs__trigger" aria-selected={item.id === active?.id} disabled={item.disabled} onClick={() => select(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {renderPanel && active ? <div role="tabpanel">{active.content}</div> : null}
    </div>
  )
}

export interface AccordionProps {
  items: Array<{ id: string; title: ReactNode; content: ReactNode }>
  allowMultiple?: boolean
  defaultOpenIds?: string[]
  className?: string
}

export function Accordion({ allowMultiple = false, className, defaultOpenIds = [], items }: AccordionProps) {
  const [openIds, setOpenIds] = useState(() => new Set(defaultOpenIds))
  const toggle = (id: string) => setOpenIds((current) => {
    const next = allowMultiple ? new Set(current) : new Set<string>()
    if (!current.has(id)) next.add(id)
    else if (allowMultiple) next.delete(id)
    return next
  })
  return <div className={cn("site-accordion-list", className)}>{items.map((item) => {
    const open = openIds.has(item.id)
    const panelId = `site-accordion-${item.id}`
    return <div className="site-accordion" data-state={open ? "open" : "closed"} key={item.id}><button type="button" className="site-accordion__trigger" aria-expanded={open} aria-controls={panelId} onClick={() => toggle(item.id)}><span>{item.title}</span><span className="site-accordion__icon" aria-hidden="true"><Plus /></span></button><div className="site-accordion__panel" aria-hidden={!open}><div className="site-accordion__content" id={panelId}>{item.content}</div></div></div>
  })}</div>
}

export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return <span className="site-tooltip">{children}<span role="tooltip" className="site-tooltip__content">{content}</span></span>
}

export function Popover({ children, content, label = "Открыть" }: { children: ReactNode; content: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return <span className="site-popover"><span onClick={() => setOpen((current) => !current)} aria-label={label}>{children}</span>{open ? <span className="site-popover__content">{content}</span> : null}</span>
}
