import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useFixtureData } from "@app/lib/data-mode"

const queryRootByEntity: Record<string, string> = {
  task: "tasks",
  booking: "bookings",
  resource: "resources",
  payment: "payments",
  customer: "customers",
  lead: "leads",
  program: "programs",
  event: "events",
  saved_view: "saved-views",
}

type LiveEvent = {
  entityType: string
  entityId: string
  event: string
  version: number
}

export function LiveUpdates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (useFixtureData) return
    if (typeof EventSource === "undefined") return
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/internal/v1"
    const source = new EventSource(`${baseUrl.replace(/\/$/, "")}/live/events`, { withCredentials: true })
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as LiveEvent
        void queryClient.invalidateQueries({ queryKey: ["notifications"] })
        const queryRoot = queryRootByEntity[event.entityType]
        if (queryRoot) void queryClient.invalidateQueries({ queryKey: [queryRoot] })
        if (event.event.startsWith("payment.")) {
          void queryClient.invalidateQueries({ queryKey: ["payments"] })
          void queryClient.invalidateQueries({ queryKey: ["finance"] })
          void queryClient.invalidateQueries({ queryKey: ["bookings"] })
        }
      } catch {
        // Malformed events are ignored; EventSource remains connected and the
        // next regular refetch still reconciles server state.
      }
    }
    return () => source.close()
  }, [queryClient])

  return null
}
