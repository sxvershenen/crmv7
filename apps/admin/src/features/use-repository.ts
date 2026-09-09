import { useCallback, useEffect, useState } from "react"

export type RepositoryState<T> = { data?: T; error?: string; cause?: unknown; loading: boolean; reload: () => void }

export function useRepository<T>(loader: () => Promise<T>): RepositoryState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [cause, setCause] = useState<unknown>()
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    setCause(undefined)
    void loader().then((result) => { if (active) setData(result) }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "Неизвестная ошибка"); setCause(reason) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loader, attempt])

  return { ...(data === undefined ? {} : { data }), ...(error === undefined ? {} : { error }), ...(cause === undefined ? {} : { cause }), loading, reload }
}
