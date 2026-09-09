import { createContext, useContext } from "react"

import type { SessionUser } from "@crm/contracts/auth"

export type AdminAuthSessionValue = {
  user: SessionUser
  logout: () => Promise<void>
}

export const AdminAuthSessionContext = createContext<AdminAuthSessionValue | null>(null)

export function useAdminAuthSession() {
  const session = useContext(AdminAuthSessionContext)
  if (!session) throw new Error("useAdminAuthSession must be used inside AdminAuthSessionProvider")
  return session
}
