import { useEffect, useState } from "react"

import { directoryRepository, loadDirectoryData, type AssigneeScope, type DirectoryData } from "@app/data/directory-repository"

let cachedData: DirectoryData | null = null
let pendingLoad: Promise<DirectoryData> | null = null

function loadOnce() {
  pendingLoad ??= loadDirectoryData(directoryRepository).then((data) => {
    cachedData = data
    return data
  }).catch((error: unknown) => {
    pendingLoad = null
    throw error
  })
  return pendingLoad
}

export function useDirectoryData() {
  const [data, setData] = useState<DirectoryData | null>(cachedData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) return
    let active = true
    void loadOnce()
      .then((nextData) => { if (active) setData(nextData) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить справочники") })
    return () => { active = false }
  }, [data])

  return { data, error, loading: !data && !error }
}

export function useDirectoryAssignees(scope: AssigneeScope) {
  return useDirectoryData().data?.assignees[scope] ?? []
}

export function useDirectoryCustomers() {
  return useDirectoryData().data?.customers ?? []
}

export function useDirectoryBookings() {
  return useDirectoryData().data?.bookings ?? []
}

export function useDirectoryLeads() {
  return useDirectoryData().data?.leads ?? []
}

export function useDirectoryResources() {
  return useDirectoryData().data?.resources ?? []
}
