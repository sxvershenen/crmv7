import { useContext, useEffect } from "react"
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom"

import { registerUnsavedChanges } from "./unsaved-changes-registry"

const DEFAULT_MESSAGE = "Есть несохранённые изменения. Покинуть страницу?"

export function UnsavedChangesGuard({ includeSearch = false, message = DEFAULT_MESSAGE, when }: { includeSearch?: boolean; message?: string; when: boolean }) {
  const dataRouter = useContext(UNSAFE_DataRouterContext)

  useEffect(() => {
    if (when) return registerUnsavedChanges()
    return undefined
  }, [when])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!when) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [when])

  return dataRouter ? <DataRouterGuard includeSearch={includeSearch} message={message} when={when} /> : null
}

function DataRouterGuard({ includeSearch, message, when }: { includeSearch: boolean; message: string; when: boolean }) {
  const blocker = useBlocker(({ currentLocation, historyAction, nextLocation }) => when && (includeSearch || historyAction !== "REPLACE") && (currentLocation.pathname !== nextLocation.pathname || (includeSearch && currentLocation.search !== nextLocation.search)))

  useEffect(() => {
    if (blocker.state !== "blocked") return
    if (window.confirm(message)) blocker.proceed()
    else blocker.reset()
  }, [blocker, message])

  return null
}
