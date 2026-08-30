import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { Response } from "express"

import { ChangePasswordInputSchema, LoginRequestSchema, type ChangePasswordInput, type LoginRequest } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { AuthService } from "./auth.service.js"

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) input: LoginRequest,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const ttlHours = this.config.get<number>("SESSION_TTL_HOURS", 168)
    const result = await this.authService.login(input, ttlHours, request.requestId, request.ip)
    response.cookie(this.config.get<string>("SESSION_COOKIE_NAME", "sv_session"), result.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("APP_ENV") === "production",
      maxAge: ttlHours * 60 * 60 * 1000,
      path: "/",
    })
    return { user: result.user }
  }

  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const cookieName = this.config.get<string>("SESSION_COOKIE_NAME", "sv_session")
    await this.authService.logout(
      (request.cookies as Record<string, string> | undefined)?.[cookieName],
      request.sessionUser!.id,
      request.requestId,
    )
    response.clearCookie(cookieName, { path: "/" })
    return { ok: true }
  }

  @Get("session")
  session(@Req() request: AuthenticatedRequest) {
    return { user: request.sessionUser }
  }

  @Post("change-password")
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordInputSchema)) input: ChangePasswordInput,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.changePassword(request.sessionUser!.id, input, request.requestId)
    response.clearCookie(this.config.get<string>("SESSION_COOKIE_NAME", "sv_session"), { path: "/" })
    return result
  }
}
