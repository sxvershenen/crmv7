import { useMemo, useState, type ReactNode } from "react"

import { EditorLayoutContext, type EditorLayoutChrome } from "@app/app/editor-layout-context"

export function EditorLayoutProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<EditorLayoutChrome | null>(null)
  const value = useMemo(() => ({ chrome, setChrome }), [chrome])

  return <EditorLayoutContext.Provider value={value}>{children}</EditorLayoutContext.Provider>
}
