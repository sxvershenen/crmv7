import { randomUUID } from "node:crypto"

import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import { DataSource, Repository } from "typeorm"

import type { ChangePasswordInput, LoginRequest, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, SessionEntity, UserEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"

import { hashPassword, verifyPassword } from "./password.js"

@Injectable()
export class AuthService {
  private readonly loginFailures = new Map<string, { count: number; resetAt: number }>()

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  async login(input: LoginRequest, ttlHours: number, requestId: string, remoteAddress = "unknown"): Promise<{ sessionId: string; user: SessionUser }> {
    const throttleKey = `${input.email.toLocaleLowerCase("ru-RU")}:${remoteAddress}`
    this.assertLoginAllowed(throttleKey)
    const user = await this.users.findOneBy({ email: input.email.toLocaleLowerCase("ru-RU") })
    if (!user || user.status !== "active" || !(await verifyPassword(input.password, user.passwordHash))) {
      this.recordLoginFailure(throttleKey)
      throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Неверный e-mail или пароль" })
    }
    this.loginFailures.delete(throttleKey)
    const now = new Date()
    const session = this.sessions.create({
      id: randomUUID(),
      userId: user.id,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
    })
    await this.sessions.save(session)
    await this.recordAuthAudit(user.id, "login", requestId)
    return { sessionId: session.id, user: this.toSessionUser(user) }
  }

  async logout(sessionId: string | undefined, userId: string, requestId: string) {
    if (sessionId) await this.sessions.delete({ id: sessionId })
    await this.recordAuthAudit(userId, "logout", requestId)
  }

  async changePassword(userId: string, input: ChangePasswordInput, requestId: string) {
    const user = await this.users.findOneByOrFail({ id: userId })
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({ code: "INVALID_CURRENT_PASSWORD", message: "Текущий пароль указан неверно", fieldErrors: { currentPassword: ["Неверный пароль"] } })
    }
    user.passwordHash = await hashPassword(input.newPassword)
    user.updatedBy = user.id
    await this.users.save(user)
    await this.sessions.delete({ userId })
    await this.recordAuthAudit(user.id, "password_changed", requestId)
    return { ok: true }
  }

  async resolveSession(cookies: Record<string, string> | undefined): Promise<SessionUser | null> {
    const cookieName = this.config.get<string>("SESSION_COOKIE_NAME", "sv_session")
    const sessionId = cookies?.[cookieName]
    if (!sessionId) return null
    const session = await this.sessions.findOneBy({ id: sessionId })
    if (!session || session.expiresAt <= new Date()) return null
    const user = await this.users.findOneBy({ id: session.userId })
    if (!user || user.status !== "active") return null
    await this.sessions.update({ id: session.id }, { lastSeenAt: new Date() })
    return this.toSessionUser(user)
  }

  private toSessionUser(user: UserEntity): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role as SessionUser["role"],
      capabilities: roleCapabilities(user.role as SessionUser["role"]),
    }
  }

  private assertLoginAllowed(key: string) {
    const failure = this.loginFailures.get(key)
    if (!failure) return
    if (failure.resetAt <= Date.now()) {
      this.loginFailures.delete(key)
      return
    }
    if (failure.count >= 5) throw new HttpException({ code: "RATE_LIMITED", message: "Слишком много попыток входа. Повторите позже" }, HttpStatus.TOO_MANY_REQUESTS)
  }

  private recordLoginFailure(key: string) {
    const current = this.loginFailures.get(key)
    const resetAt = current && current.resetAt > Date.now() ? current.resetAt : Date.now() + 15 * 60_000
    this.loginFailures.set(key, { count: (current?.resetAt ?? 0) > Date.now() ? current!.count + 1 : 1, resetAt })
  }

  private async recordAuthAudit(userId: string, action: string, requestId: string) {
    await this.dataSource.getRepository(ChangeLogEntity).save({
      id: randomUUID(), entityType: "user_session", entityId: userId, action, actorId: userId,
      requestId, changes: {}, createdAt: new Date(),
    })
  }
}
