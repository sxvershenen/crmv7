import type { APIRoute } from "astro"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const imageTypes = new Set(["image/avif", "image/webp", "image/png", "image/jpeg"])

export const GET: APIRoute = async ({ params }) => {
  const { assetId, variantId } = params
  if (!assetId || !variantId || !uuid.test(assetId) || !uuid.test(variantId)) return new Response(null, { status: 404 })

  const apiBase = (import.meta.env.CMS_PUBLIC_API_BASE_URL || "http://127.0.0.1:3000/api/public/v1").replace(/\/$/, "")
  let upstream: Response
  try {
    upstream = await fetch(`${apiBase}/media/${assetId}/${variantId}`, { redirect: "error" })
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 404 : 503, headers: { "Cache-Control": "no-store" } })
  const contentType = upstream.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase()
  if (!contentType || !imageTypes.has(contentType)) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } })

  const headers = new Headers({ "Content-Type": contentType, "X-Content-Type-Options": "nosniff" })
  for (const name of ["Cache-Control", "ETag", "Last-Modified"]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: 200, headers })
}
