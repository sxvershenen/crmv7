import type { APIRoute } from "astro"

export const GET: APIRoute = ({ site }) => {
  const origin = site?.toString().replace(/\/$/, "")
  const sitemap = origin ? `${origin}/sitemap-index.xml` : "/sitemap-index.xml"

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
