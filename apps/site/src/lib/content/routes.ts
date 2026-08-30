export type PublicRoute = {
  readonly pathname: `/${string}`
  readonly changeFrequency: "daily" | "weekly" | "monthly" | "yearly"
}

/**
 * The static public route inventory is the only source for robots and sitemap
 * generation until the content/admin API is introduced.
 */
export const publicRoutes = [
  { pathname: "/", changeFrequency: "weekly" },
  { pathname: "/privacy", changeFrequency: "yearly" },
] as const satisfies readonly PublicRoute[]

export function publicRoute(pathname: PublicRoute["pathname"]): PublicRoute {
  const route = publicRoutes.find((candidate) => candidate.pathname === pathname)

  if (!route) {
    throw new Error(`No public route registered for ${pathname}`)
  }

  return route
}
