import { z } from "zod";

import { CmsPathSchema } from "./content.js";
import { DateTimeSchema, IdSchema } from "./primitives.js";

export const PUBLIC_ROUTE_PREFIX_MIGRATIONS = [
  ["/houses", "/domiki"],
  ["/campgrounds", "/kemping"],
  ["/addons", "/dopy"],
  ["/venues", "/poshadki"],
  ["/programs", "/programmy"],
  ["/events", "/meropriyatiya"],
  ["/event-services", "/meropriyatiya"],
] as const;

export function canonicalPublicPath(path: string): string {
  if (path === "/resources/sauna-chan") return "/dopy/sauna-chan";
  for (const [legacy, canonical] of PUBLIC_ROUTE_PREFIX_MIGRATIONS) {
    if (path === legacy || path.startsWith(`${legacy}/`)) return `${canonical}${path.slice(legacy.length)}`;
  }
  return path;
}

/** Candidate paths are ordered so a native canonical release item wins over a legacy alias. */
export function publicReleasePathCandidates(path: string): string[] {
  const canonical = canonicalPublicPath(path);
  const candidates = [canonical];
  for (const [legacy, target] of PUBLIC_ROUTE_PREFIX_MIGRATIONS) {
    if (canonical === target || canonical.startsWith(`${target}/`)) candidates.push(`${legacy}${canonical.slice(target.length)}`);
  }
  if (canonical === "/dopy/sauna-chan") candidates.push("/resources/sauna-chan");
  return [...new Set(candidates)];
}

export const PublicRouteManifestEntrySchema = z.object({
  path: CmsPathSchema,
  lastModified: DateTimeSchema,
  schemaTypes: z.array(z.string().min(1).max(120)).max(20),
}).strict();

export const PublicRouteRedirectSchema = z.object({
  sourcePath: CmsPathSchema,
  destinationPath: CmsPathSchema,
  statusCode: z.literal(301),
}).strict();

export const PublicRouteManifestSchema = z.object({
  releaseId: IdSchema,
  generatedAt: DateTimeSchema,
  routes: z.array(PublicRouteManifestEntrySchema).max(20_000),
  redirects: z.array(PublicRouteRedirectSchema).max(20_000),
  cache: z.object({
    etag: z.string().min(1).max(200),
    maxAgeSeconds: z.number().int().nonnegative().max(86400),
    staleWhileRevalidateSeconds: z.number().int().nonnegative().max(604800),
    tags: z.array(z.string().min(1).max(200)).max(500),
  }).strict(),
}).strict();
export type PublicRouteManifest = z.infer<typeof PublicRouteManifestSchema>;
