import { createHmac, randomBytes } from "node:crypto"
import { isIP } from "node:net"

import { HttpException, HttpStatus, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DataSource } from "typeorm"

type CountRow = { request_count: number | string }

@Injectable()
export class PublicIntakeRateLimiter {
  private readonly hmacSecret: string
  private readonly limit: number
  private readonly windowSeconds: number

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.limit = config.get<number>("PUBLIC_INTAKE_RATE_LIMIT_MAX", 10)
    this.windowSeconds = config.get<number>("PUBLIC_INTAKE_RATE_LIMIT_WINDOW_SECONDS", 60)
    // Production configuration rejects a missing secret. This process-local fallback is only for dev/test.
    this.hmacSecret = config.get<string>("PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET") ?? randomBytes(32).toString("hex")
  }

  async consume(rawAddress: string | undefined): Promise<void> {
    const address = this.normalizeAddress(rawAddress)
    if (!address) throw this.unavailable()
    const identifierHash = createHmac("sha256", this.hmacSecret).update(`public-intake:${address}`).digest("hex")

    let rows: CountRow[]
    try {
      rows = await this.dataSource.query<CountRow[]>(`
        WITH cleanup AS (
          DELETE FROM public_intake_rate_limits WHERE expires_at <= now()
        ), bucket AS (
          SELECT to_timestamp(floor(extract(epoch FROM now()) / $2) * $2) AS started_at
        )
        INSERT INTO public_intake_rate_limits(identifier_hash, window_started_at, request_count, expires_at)
        SELECT $1, bucket.started_at, 1, bucket.started_at + ($2 * interval '1 second')
        FROM bucket
        ON CONFLICT (identifier_hash, window_started_at) DO UPDATE
          SET request_count = public_intake_rate_limits.request_count + 1
        RETURNING request_count
      `, [identifierHash, this.windowSeconds])
    } catch {
      // Intake must not bypass abuse protection when its shared store is unavailable.
      throw this.unavailable()
    }

    if (Number(rows[0]?.request_count ?? this.limit + 1) > this.limit) {
      throw new HttpException({ code: "RATE_LIMITED", message: "Слишком много запросов. Повторите позже", details: {} }, HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  private normalizeAddress(value: string | undefined): string | null {
    if (!value) return null
    const candidate = value.trim().replace(/^::ffff:/u, "")
    return isIP(candidate) ? candidate.toLocaleLowerCase("en-US") : null
  }

  private unavailable() {
    return new ServiceUnavailableException({ code: "INTAKE_PROTECTION_UNAVAILABLE", message: "Приём заявок временно недоступен", details: {} })
  }
}
