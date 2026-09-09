import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { TooltipProvider } from "@crm/ui"

import { AdminRouter } from "@admin/app/router"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Root element is missing")

createRoot(root).render(<StrictMode><TooltipProvider><AdminAuthSessionProvider><AdminRouter /></AdminAuthSessionProvider></TooltipProvider></StrictMode>)
