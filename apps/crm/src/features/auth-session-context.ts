import { createContext, useContext } from "react"

import type { SessionUser } from "@crm/contracts"

export type AuthSessionContextValue = {
  logout: () => Promise<void>
  user: SessionUser
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

export function useAuthSession() {
  return useContext(AuthSessionContext)
}
