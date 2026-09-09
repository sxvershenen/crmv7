import type { CSSProperties, ImgHTMLAttributes, ReactNode } from "react"
import { cn } from "../lib/cn"

export interface MediaSource { srcSet: string; media?: string; type?: "image/webp" | "image/avif" }
export interface ResponsiveMediaProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  src: string
  alt: string
  width: number
  height: number
  sources?: MediaSource[]
  focalPoint?: { x: number; y: number }
  aspectRatio?: string
  fit?: "cover" | "contain"
  wrapperClassName?: string
  overlay?: ReactNode
}

export function ResponsiveMedia({ alt, aspectRatio, className, fit = "cover", focalPoint = { x: 50, y: 50 }, height, overlay, sources = [], src, width, wrapperClassName, ...props }: ResponsiveMediaProps) {
  const style = {
    "--site-media-aspect": aspectRatio ?? `${width} / ${height}`,
    "--site-media-fit": fit,
    "--site-media-position": `${Math.max(0, Math.min(100, focalPoint.x))}% ${Math.max(0, Math.min(100, focalPoint.y))}%`,
  } as CSSProperties
  return <picture className={cn("site-media", wrapperClassName)} style={style}>{sources.map((source) => <source key={`${source.srcSet}-${source.media ?? "all"}`} srcSet={source.srcSet} media={source.media} type={source.type} />)}<img src={src} alt={alt} width={width} height={height} className={className} {...props} />{overlay}</picture>
}
