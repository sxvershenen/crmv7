import { randomUUID } from "node:crypto"

import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common"
import type { Response } from "express"
import type { Observable } from "rxjs"

import type { AuthenticatedRequest } from "./request-context.js"

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const response = context.switchToHttp().getResponse<Response>()
    const requestId = request.header("x-request-id")?.slice(0, 128) || randomUUID()
    request.requestId = requestId
    response.setHeader("x-request-id", requestId)
    return next.handle()
  }
}
