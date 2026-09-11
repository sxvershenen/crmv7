import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { Request, Response } from "express"

export const ANALYTICS_VISITOR_COOKIE = "sv_analytics_visitor"
export const ANALYTICS_SESSION_COOKIE = "sv_analytics_session"
const sessionTtlSeconds = 30 * 60
const visitorTtlSeconds = 90 * 24 * 60 * 60

type IdentityPayload = { id: string; issuedAt: number; expiresAt: number; lastSeenAt?: number }
export type AnalyticsIdentity = { visitorId: string; sessionId: string }

@Injectable()
export class AnalyticsIdentityService {
  private readonly secret: string
  private readonly secure: boolean

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.secret = config.get<string>("ANALYTICS_COOKIE_SIGNING_SECRET") ?? randomBytes(32).toString("hex")
    this.secure = config.get<string>("APP_ENV", "development") === "production"
  }

  issue(request: Request, response: Response, now = Date.now()): AnalyticsIdentity {
    const visitor = this.read(request.cookies?.[ANALYTICS_VISITOR_COOKIE], now, false) ?? this.create(now, visitorTtlSeconds)
    const session = this.read(request.cookies?.[ANALYTICS_SESSION_COOKIE], now, true)
    const currentSession = session && now - (session.lastSeenAt ?? session.issuedAt) <= sessionTtlSeconds * 1000
      ? { ...session, lastSeenAt: now, expiresAt: now + sessionTtlSeconds * 1000 }
      : this.create(now, sessionTtlSeconds, true)

    this.setCookie(response, ANALYTICS_VISITOR_COOKIE, visitor, visitorTtlSeconds)
    this.setCookie(response, ANALYTICS_SESSION_COOKIE, currentSession, sessionTtlSeconds)
    return { visitorId: visitor.id, sessionId: currentSession.id }
  }

  private create(now: number, ttlSeconds: number, withLastSeen = false): IdentityPayload {
    return { id: randomUUID(), issuedAt: now, expiresAt: now + ttlSeconds * 1000, ...(withLastSeen ? { lastSeenAt: now } : {}) }
  }

  private read(value: unknown, now: number, session: boolean): IdentityPayload | null {
    if (typeof value !== "string") return null
    const [encoded, signature] = value.split(".")
    if (!encoded || !signature) return null
    const expected = createHmac("sha256", this.secret).update(encoded).digest("base64url")
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as IdentityPayload
      if (!payload.id || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now) return null
      if (session && !Number.isSafeInteger(payload.lastSeenAt)) return null
      return payload
    } catch {
      return null
    }
  }

  private setCookie(response: Response, name: string, payload: IdentityPayload, maxAgeSeconds: number) {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
    const signature = createHmac("sha256", this.secret).update(encoded).digest("base64url")
    response.cookie(name, `${encoded}.${signature}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secure,
      path: "/",
      maxAge: maxAgeSeconds * 1000,
    })
  }
}
