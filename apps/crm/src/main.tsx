import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@crm/ui"

import { AppRouter } from "@app/app/router"
import { AuthSessionProvider } from "@app/features/auth-session"
import { LiveUpdates } from "@app/features/live-updates"
import { InvitationPage } from "@app/pages/invitation-page"

import "./index.css"

const root = document.getElementById("root")

if (!root) throw new Error("Root element is missing")

const queryClient = new QueryClient()
const invitationRoute = window.location.pathname === "/invite"

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {invitationRoute ? <TooltipProvider><InvitationPage /></TooltipProvider> : <AuthSessionProvider>
        <LiveUpdates />
        <TooltipProvider>
          <AppRouter />
        </TooltipProvider>
      </AuthSessionProvider>}
    </QueryClientProvider>
  </StrictMode>,
)
