import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from "@nestjs/common"
import type { Response } from "express"
import { QueryFailedError } from "typeorm"

import { DomainError } from "@crm/domain"

import type { AuthenticatedRequest } from "./request-context.js"

type ErrorPayload = {
  code?: string
  message?: string
  fieldErrors?: Record<string, string[]>
  details?: Record<string, unknown>
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp()
    const request = http.getRequest<AuthenticatedRequest>()
    const response = http.getResponse<Response>()
    const payload = this.toPayload(error)
    if (payload.status >= 500) {
      this.logger.error(error instanceof Error ? error.message : "Unhandled non-Error exception", error instanceof Error ? error.stack : undefined)
    }
    response.status(payload.status).json({
      code: payload.body.code ?? "INTERNAL_ERROR",
      message: payload.body.message ?? "Внутренняя ошибка",
      fieldErrors: payload.body.fieldErrors ?? {},
      details: payload.body.details ?? {},
      requestId: request.requestId ?? "unknown",
    })
  }

  private toPayload(error: unknown): { status: number; body: ErrorPayload } {
    if (error instanceof HttpException) {
      const response = error.getResponse()
      if (typeof response === "string") return { status: error.getStatus(), body: { message: response } }
      return { status: error.getStatus(), body: response as ErrorPayload }
    }
    if (error instanceof DomainError) {
      const statusByCode: Partial<Record<DomainError["code"], number>> = {
        PERMISSION_DENIED: HttpStatus.FORBIDDEN,
        INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
        CAPACITY_EXCEEDED: HttpStatus.CONFLICT,
        IDEMPOTENCY_CONFLICT: HttpStatus.CONFLICT,
        INVALID_INTERVAL: HttpStatus.UNPROCESSABLE_ENTITY,
        INVALID_MONEY: HttpStatus.UNPROCESSABLE_ENTITY,
        CURRENCY_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
        PAYMENT_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
        PAYMENT_IMMUTABLE: HttpStatus.CONFLICT,
        INVALID_IDEMPOTENCY_INPUT: HttpStatus.BAD_REQUEST,
      }
      return {
        status: statusByCode[error.code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          code: error.code,
          message: error.message,
          fieldErrors: Object.fromEntries(
            Object.entries(error.fieldErrors).map(([field, messages]) => [field, [...messages]]),
          ),
          details: { ...error.details },
        },
      }
    }
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as { code?: string; constraint?: string }
      const code = driverError.code
      if (code === "23P01") {
        if (driverError.constraint?.startsWith("price_books_")) {
          return {
            status: HttpStatus.CONFLICT,
            body: { code: "PRICE_BOOK_PERIOD_CONFLICT", message: "Периоды действия прайс-листов пересекаются", details: { constraint: driverError.constraint } },
          }
        }
        return {
          status: HttpStatus.CONFLICT,
          body: { code: "RESOURCE_CONFLICT", message: "Ресурс уже занят", details: {} },
        }
      }
      if (code === "23505") {
        return {
          status: HttpStatus.CONFLICT,
          body: { code: "DUPLICATE", message: "Такая запись уже существует", details: {} },
        }
      }
      if (code === "40001" || code === "40P01") {
        return {
          status: HttpStatus.CONFLICT,
          body: { code: "CONFLICT", message: "Запись была изменена параллельно. Повторите операцию", details: { retryable: true } },
        }
      }
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: {} }
  }
}
