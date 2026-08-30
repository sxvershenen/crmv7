import { Injectable } from "@nestjs/common"
import { filter, map, Subject } from "rxjs"

type LiveEvent = { entityType: string; entityId: string; event: string; version: number }

@Injectable()
export class LiveService {
  private readonly events = new Subject<LiveEvent>()

  publish(event: LiveEvent) {
    this.events.next(event)
  }

  stream(entityType?: string) {
    return this.events.pipe(
      filter((event) => !entityType || event.entityType === entityType),
      // Keep the default `message` event so one EventSource handler can process
      // every entity topic; the concrete topic remains available in `data.event`.
      map((data) => ({ data })),
    )
  }
}
