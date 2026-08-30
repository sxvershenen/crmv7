import { Controller, Inject, Query, Sse } from "@nestjs/common"

import { LiveService } from "./live.service.js"

@Controller("live")
export class LiveController {
  constructor(@Inject(LiveService) private readonly live: LiveService) {}

  @Sse("events")
  events(@Query("entityType") entityType?: string) {
    return this.live.stream(entityType)
  }
}
