import { lazy, Suspense, type ReactNode } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"

import { Skeleton } from "@crm/ui"

import { AppShell } from "@app/app/app-shell"

const DashboardPage = lazy(() =>
  import("@app/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })),
)
const DevUiPage = lazy(() =>
  import("@app/pages/dev-ui-page").then((module) => ({ default: module.DevUiPage })),
)
const LeadsPage = lazy(() =>
  import("@app/pages/leads-page").then((module) => ({ default: module.LeadsPage })),
)
const LeadEditorPage = lazy(() =>
  import("@app/pages/lead-editor-page").then((module) => ({ default: module.LeadEditorPage })),
)
const BookingsPage = lazy(() =>
  import("@app/pages/bookings-page").then((module) => ({ default: module.BookingsPage })),
)
const BookingEditorPage = lazy(() =>
  import("@app/pages/booking-editor-page").then((module) => ({ default: module.BookingEditorPage })),
)
const CustomersPage = lazy(() =>
  import("@app/pages/customers-page").then((module) => ({ default: module.CustomersPage })),
)
const CustomerEditorPage = lazy(() =>
  import("@app/pages/customer-editor-page").then((module) => ({ default: module.CustomerEditorPage })),
)
const ResourcesPage = lazy(() =>
  import("@app/pages/resources-page").then((module) => ({ default: module.ResourcesPage })),
)
const ResourceEditorPage = lazy(() =>
  import("@app/pages/resource-editor-page").then((module) => ({ default: module.ResourceEditorPage })),
)
const ProgramsPage = lazy(() =>
  import("@app/pages/programs-page").then((module) => ({ default: module.ProgramsPage })),
)
const ProgramTemplateEditorPage = lazy(() =>
  import("@app/pages/program-template-editor-page").then((module) => ({ default: module.ProgramTemplateEditorPage })),
)
const ProgramRunEditorPage = lazy(() =>
  import("@app/pages/program-run-editor-page").then((module) => ({ default: module.ProgramRunEditorPage })),
)
const ProgramRegistrationEditorPage = lazy(() =>
  import("@app/pages/program-registration-editor-page").then((module) => ({ default: module.ProgramRegistrationEditorPage })),
)
const ProgramCategoriesPage = lazy(() =>
  import("@app/pages/program-categories-page").then((module) => ({ default: module.ProgramCategoriesPage })),
)
const EventsPage = lazy(() =>
  import("@app/pages/events-page").then((module) => ({ default: module.EventsPage })),
)
const EventEditorPage = lazy(() =>
  import("@app/pages/event-editor-page").then((module) => ({ default: module.EventEditorPage })),
)
const TasksPage = lazy(() =>
  import("@app/pages/tasks-page").then((module) => ({ default: module.TasksPage })),
)
const TaskEditorPage = lazy(() =>
  import("@app/pages/task-editor-page").then((module) => ({ default: module.TaskEditorPage })),
)
const FinancePage = lazy(() =>
  import("@app/pages/finance-page").then((module) => ({ default: module.FinancePage })),
)
const EventCategoriesPage = lazy(() =>
  import("@app/pages/event-categories-page").then((module) => ({ default: module.EventCategoriesPage })),
)
const ProgramCategoryEditorPage = lazy(() =>
  import("@app/pages/program-category-editor-page").then((module) => ({ default: module.ProgramCategoryEditorPage })),
)
const EventCategoryEditorPage = lazy(() =>
  import("@app/pages/event-category-editor-page").then((module) => ({ default: module.EventCategoryEditorPage })),
)
const PlaceholderPage = lazy(() =>
  import("@app/pages/placeholder-page").then((module) => ({ default: module.PlaceholderPage })),
)
const ProfilePage = lazy(() =>
  import("@app/pages/profile-page").then((module) => ({ default: module.ProfilePage })),
)
const TeamPage = lazy(() =>
  import("@app/pages/team-page").then((module) => ({ default: module.TeamPage })),
)
const SettingsPage = lazy(() =>
  import("@app/pages/settings-page").then((module) => ({ default: module.SettingsPage })),
)

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div aria-label="Загрузка экрана" className="mx-auto max-w-[1480px] space-y-4 p-5" role="status">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<LazyRoute><DashboardPage /></LazyRoute>} index />
          <Route element={<LazyRoute><DevUiPage /></LazyRoute>} path="dev/ui" />
          <Route element={<LazyRoute><LeadsPage /></LazyRoute>} path="leads" />
          <Route element={<LazyRoute><BookingsPage /></LazyRoute>} path="bookings" />
          <Route element={<LazyRoute><BookingsPage defaultView="scheduler" /></LazyRoute>} path="schedule" />
          <Route element={<LazyRoute><CustomersPage /></LazyRoute>} path="customers" />
          <Route element={<LazyRoute><ResourcesPage /></LazyRoute>} path="resources/:kind" />
          <Route element={<LazyRoute><ProgramsPage /></LazyRoute>} path="programs" />
          <Route element={<LazyRoute><ProgramCategoriesPage /></LazyRoute>} path="programs/categories" />
          <Route element={<LazyRoute><EventsPage /></LazyRoute>} path="events" />
          <Route element={<LazyRoute><TasksPage /></LazyRoute>} path="tasks" />
          <Route element={<LazyRoute><FinancePage /></LazyRoute>} path="finance" />
          <Route element={<LazyRoute><ProfilePage /></LazyRoute>} path="profile" />
          <Route element={<LazyRoute><TeamPage /></LazyRoute>} path="team" />
          <Route element={<LazyRoute><SettingsPage /></LazyRoute>} path="settings" />
          <Route element={<LazyRoute><EventCategoriesPage /></LazyRoute>} path="events/categories" />
          <Route element={<LazyRoute><EventEditorPage /></LazyRoute>} path="events/new" />
          <Route element={<LazyRoute><EventCategoryEditorPage /></LazyRoute>} path="events/categories/new" />
          <Route element={<LazyRoute><EventCategoryEditorPage /></LazyRoute>} path="events/categories/:id" />
          <Route element={<LazyRoute><ProgramCategoryEditorPage /></LazyRoute>} path="programs/categories/new" />
          <Route element={<LazyRoute><ProgramCategoryEditorPage /></LazyRoute>} path="programs/categories/:id" />
          <Route element={<LazyRoute><ProgramRunEditorPage /></LazyRoute>} path="programs/runs/:id" />
          <Route element={<LazyRoute><ProgramRegistrationEditorPage /></LazyRoute>} path="programs/registrations/:id" />
          <Route element={<LazyRoute><ResourceEditorPage /></LazyRoute>} path="resources/:kind/:resourceId" />
          <Route element={<LazyRoute><BookingEditorPage /></LazyRoute>} path="bookings/:id" />
          <Route element={<LazyRoute><CustomerEditorPage /></LazyRoute>} path="customers/:id" />
          <Route element={<LazyRoute><LeadEditorPage /></LazyRoute>} path="leads/:id" />
          <Route element={<LazyRoute><TaskEditorPage /></LazyRoute>} path="tasks/:id" />
          <Route element={<LazyRoute><TaskEditorPage /></LazyRoute>} path="tasks/new" />
          <Route element={<LazyRoute><ProgramTemplateEditorPage /></LazyRoute>} path="programs/:id" />
          <Route element={<LazyRoute><EventEditorPage /></LazyRoute>} path="events/:id" />
          <Route element={<LazyRoute><PlaceholderPage /></LazyRoute>} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
