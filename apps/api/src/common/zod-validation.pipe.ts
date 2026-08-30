import { BadRequestException, type PipeTransform } from "@nestjs/common"
import type { ZodType } from "zod"

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (result.success) return result.data

    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "form"
      fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message]
    }
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Проверьте заполнение полей",
      fieldErrors,
      details: {},
    })
  }
}
