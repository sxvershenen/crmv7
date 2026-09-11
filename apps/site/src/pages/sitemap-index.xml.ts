import type { APIRoute } from "astro"

import { getPublishedRouteManifest } from "../lib/content/cms-public"

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    }

    return entities[character] ?? character
  })
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    return new Response("Site URL is not configured", { status: 500 })
  }

  const manifest = await getPublishedRouteManifest()
  if (manifest.status !== "published") {
    return new Response("Published route manifest is unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" } })
  }
  const urls = manifest.value.routes
    .map(({ path, lastModified }) => `  <url><loc>${escapeXml(new URL(path, site).toString())}</loc><lastmod>${escapeXml(lastModified.slice(0, 10))}</lastmod></url>`)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300", "ETag": manifest.value.cache.etag },
  })
}
