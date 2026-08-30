import { IconCirclesRelation, IconUserCircle } from "@tabler/icons-react"
import { NavLink } from "react-router-dom"

import { cn } from "@crm/ui"

import { navGroups } from "@app/app/navigation"

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IconCirclesRelation aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Свистоплясово</p>
          <p className="text-[10px] text-muted-foreground">CRM</p>
        </div>
      </div>

      <nav aria-label="Основная навигация" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => (
          <div className="mb-4" key={group.label}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-9 items-center gap-2.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                      isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                    )
                  }
                  end={item.href === "/"}
                  key={item.href}
                  to={item.href}
                >
                  <item.icon aria-hidden="true" className="size-4 shrink-0" stroke={1.8} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-2">
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex min-h-9 items-center gap-2.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              isActive && "bg-sidebar-accent text-foreground",
            )
          }
          to="/profile"
        >
          <IconUserCircle aria-hidden="true" className="size-4" />
          <span className="min-w-0 flex-1 truncate">Марина Кириллова</span>
          <span className="text-[9px] text-muted-foreground">Профиль</span>
        </NavLink>
      </div>
    </aside>
  )
}
