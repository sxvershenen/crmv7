import { useEffect, useState } from "react"
import { cmsRepository } from "@admin/data/cms-repository"
import type { MediaAsset } from "@admin/entities/cms"

export function readyImageUrl(asset: MediaAsset | undefined): string | undefined {
  if (asset?.kind !== "image" || asset.status !== "ready") return undefined
  return asset.variants?.find((variant) => (variant.format === "webp" || variant.format === "avif") && variant.width && variant.height)?.url
}

export function useHeroImage(assetId: string): MediaAsset | undefined {
  const [asset, setAsset] = useState<MediaAsset>()
  useEffect(() => {
    let active = true
    setAsset(undefined)
    if (assetId) void cmsRepository.getAsset(assetId).then((result) => { if (active) setAsset(result) }).catch(() => { if (active) setAsset(undefined) })
    return () => { active = false }
  }, [assetId])
  return asset
}
