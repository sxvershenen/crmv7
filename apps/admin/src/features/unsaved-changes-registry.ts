const activeGuards = new Set<string>()

export function confirmUnsavedChanges(message: string) {
  return activeGuards.size === 0 || window.confirm(message)
}

export function registerUnsavedChanges() {
  const key = globalThis.crypto?.randomUUID?.() ?? String(Date.now())
  activeGuards.add(key)
  return () => { activeGuards.delete(key) }
}
