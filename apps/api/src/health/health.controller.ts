import { Controller, Get, Inject } from "@nestjs/common"
import { DataSource } from "typeorm"

import { Public } from "../common/public.decorator.js"

@Controller("health")
export class HealthController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async getHealth() {
    await this.dataSource.query("SELECT 1")
    return { status: "ok", database: "ok", timestamp: new Date().toISOString() }
  }
}
