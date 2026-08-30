import { Outlet } from "react-router-dom"

import { EditorLayoutProvider } from "@app/app/editor-layout-provider"
import { AppSidebar } from "@app/components/app-sidebar"
import { AppTopbar } from "@app/components/app-topbar"
import { MobileNavigation } from "@app/components/mobile-navigation"

export function AppShell() {
  return (
    <EditorLayoutProvider>
      <div className="min-h-screen bg-surface-sunken">
        <a
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:translate-y-0"
          href="#main-content"
        >
          К основному содержимому
        </a>
        <AppSidebar />
        <AppTopbar />
        <main className="min-h-[calc(100vh-3.5rem)] pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:ml-60 lg:pb-0" id="main-content">
          <Outlet />
        </main>
        <MobileNavigation />
      </div>
    </EditorLayoutProvider>
  )
}
