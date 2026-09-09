import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react"

import { directoryRepository, loadDirectoryData, type AssigneeScope, type DirectoryData, type DirectoryRepository } from "@app/data/directory-repository"

const DirectoryRepositoryContext = createContext<DirectoryRepository | null>(null)
const cachedData = new WeakMap<DirectoryRepository, DirectoryData>()
const pendingLoads = new WeakMap<DirectoryRepository, Promise<DirectoryData>>()

function loadOnce(repository: DirectoryRepository) {
  const existing = pendingLoads.get(repository)
  if (existing) return existing
  const pending = loadDirectoryData(repository).then((data) => {
    cachedData.set(repository, data)
    return data
  }).catch((error: unknown) => {
    pendingLoads.delete(repository)
    throw error
  })
  pendingLoads.set(repository, pending)
  return pending
}

export function DirectoryRepositoryProvider({ children, repository }: { children: ReactNode; repository: DirectoryRepository }) {
  return createElement(DirectoryRepositoryContext.Provider, { value: repository }, children)
}

export function useDirectoryData() {
  const repository = useContext(DirectoryRepositoryContext) ?? directoryRepository
  const [state, setState] = useState<{ data: DirectoryData | null; error: string | null; repository: DirectoryRepository }>(() => ({ data: cachedData.get(repository) ?? null, error: null, repository }))
  const data = state.repository === repository ? state.data : cachedData.get(repository) ?? null
  const error = state.repository === repository ? state.error : null

  useEffect(() => {
    const cached = cachedData.get(repository)
    if (cached) {
      setState({ data: cached, error: null, repository })
      return
    }
    let active = true
    setState({ data: null, error: null, repository })
    void loadOnce(repository)
      .then((nextData) => { if (active) setState({ data: nextData, error: null, repository }) })
      .catch((reason: unknown) => { if (active) setState({ data: null, error: reason instanceof Error ? reason.message : "Не удалось загрузить справочники", repository }) })
    return () => { active = false }
  }, [repository])

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
