import { createContext, useContext, useLayoutEffect, type ReactNode } from "react"

export type EditorLayoutChrome = {
  idLabel: string
  mobileStatus?: ReactNode
  onBack: () => void
  title: string
}

export type EditorLayoutContextValue = {
  chrome: EditorLayoutChrome | null
  setChrome: (chrome: EditorLayoutChrome | null) => void
}

export const EditorLayoutContext = createContext<EditorLayoutContextValue>({
  chrome: null,
  setChrome: () => undefined,
})

export function useEditorLayout() {
  return useContext(EditorLayoutContext)
}

export function useEditorLayoutChrome(chrome: EditorLayoutChrome) {
  const { setChrome } = useEditorLayout()

  useLayoutEffect(() => {
    setChrome(chrome)
    return () => setChrome(null)
  }, [chrome, setChrome])
}
