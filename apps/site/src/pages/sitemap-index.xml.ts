import type { APIRoute } from "astro"

import { publicRoutes } from "../lib/content"

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

export const GET: APIRoute = ({ site }) => {
  if (!site) {
    return new Response("Site URL is not configured", { status: 500 })
  }

  const urls = publicRoutes
    .map(({ pathname }) => `  <url><loc>${escapeXml(new URL(pathname, site).toString())}</loc></url>`)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
