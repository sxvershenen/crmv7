import type { APIRoute } from "astro"
import { getPublishedRouteManifest } from "../lib/content/cms-public"

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.toString().replace(/\/$/, "")
  const sitemap = origin ? `${origin}/sitemap-index.xml` : "/sitemap-index.xml"

  const manifest = await getPublishedRouteManifest()
  if (manifest.status !== "published") return new Response("User-agent: *\nDisallow: /\n", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } })
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300", "ETag": manifest.value.cache.etag },
  })
}
