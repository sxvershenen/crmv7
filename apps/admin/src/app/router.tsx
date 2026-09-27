import type { ReactNode } from "react"
import { createBrowserRouter, Navigate, Route, RouterProvider, Routes } from "react-router-dom"
import type { Capabilities } from "@crm/contracts/capabilities"

import { AdminShell } from "@admin/app/shell"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { AdminUiGalleryPage } from "@admin/pages/admin-ui-gallery-page"
import { AddOnOfferingWorkspacePage } from "@admin/pages/addon-offerings-page"
import { AnalyticsPage } from "@admin/pages/analytics-page"
import { CodePage } from "@admin/pages/code-page"
import { CampgroundOfferingWorkspacePage } from "@admin/pages/campground-offerings-page"
import { ContentEditorPage } from "@admin/pages/content-editor-page"
import { ContentListPage } from "@admin/pages/content-list-page"
import { ContentTreePage } from "@admin/pages/content-tree-page"
import { DashboardPage } from "@admin/pages/dashboard-page"
import { HouseOfferingWorkspacePage } from "@admin/pages/house-offerings-page"
import { IntegrationsPage } from "@admin/pages/integrations-page"
import { ManagementPage } from "@admin/pages/management-page"
import { RedirectsPage } from "@admin/pages/redirects-page"
import { AssetPage, MediaLibraryPage } from "@admin/pages/media-pages"
import { MobileMenuPage } from "@admin/pages/mobile-menu-page"
import { NavigationPage } from "@admin/pages/navigation-page"
import { NotFoundPage } from "@admin/pages/not-found-page"
import { ReleaseDetailPage, ReleasesPage } from "@admin/pages/release-pages"
import { SeoPage } from "@admin/pages/seo-page"
import { SiteSettingsPage } from "@admin/pages/site-settings-page"
import { AccessPage } from "@admin/pages/access-page"

export function AdminRouter() {
  return <RouterProvider router={adminRouter} />
}

const adminRouter = createBrowserRouter([{ path: "*", element: <AdminRoutes /> }])

function AdminRoutes() {
  return <Routes><Route element={<AdminShell />}>
    <Route index element={<DashboardPage />} />
    <Route path="content/tree" element={<ContentTreePage />} />
    <Route path="content/home" element={<ContentEditorPage kind="home" />} />
    <Route path="content/pages" element={<Navigate replace to="/content/tree?type=landing" />} />
    <Route path="content/pages/new" element={<CapabilityRoute capability="canEditContent"><ContentEditorPage kind="landing" /></CapabilityRoute>} />
    <Route path="content/pages/:nodeId" element={<ContentEditorPage kind="landing" />} />
    <Route path="content/categories" element={<Navigate replace to="/content/tree?type=category" />} />
    <Route path="content/categories/new" element={<CapabilityRoute capability="canEditContent"><ContentEditorPage kind="category" /></CapabilityRoute>} />
    <Route path="content/categories/:nodeId" element={<ContentEditorPage kind="category" />} />
    <Route path="content/public-profiles" element={<Navigate replace to="/content/tree?type=profile" />} />
    <Route path="content/public-profiles/:entityType/:entityId" element={<ContentEditorPage kind="profile" />} />
    <Route path="content/articles" element={<ContentListPage kind="articles" />} />
    <Route path="content/articles/new" element={<CapabilityRoute capability="canEditContent"><ContentEditorPage kind="article" /></CapabilityRoute>} />
    <Route path="content/articles/:nodeId" element={<ContentEditorPage kind="article" />} />
    <Route path="offers/houses" element={<Navigate replace to="/content/tree?type=profile&source=house" />} />
    <Route path="offers/houses/:offeringId" element={<CapabilityRoute capabilities={["canView", "canViewContent"]}><HouseOfferingWorkspacePage /></CapabilityRoute>} />
    <Route path="offers/campgrounds" element={<Navigate replace to="/content/tree?type=profile&source=campground" />} />
    <Route path="offers/campgrounds/:offeringId" element={<CapabilityRoute capabilities={["canView", "canViewContent"]}><CampgroundOfferingWorkspacePage /></CapabilityRoute>} />
    <Route path="offers/addons" element={<Navigate replace to="/content/tree?type=profile&source=addon" />} />
    <Route path="offers/addons/:offeringId" element={<CapabilityRoute capabilities={["canView", "canViewContent"]}><AddOnOfferingWorkspacePage /></CapabilityRoute>} />
    <Route path="globals/sections" element={<Navigate replace to="/content/home?tab=composition" />} />
    <Route path="globals/sections/new" element={<Navigate replace to="/content/home?tab=composition" />} />
    <Route path="globals/sections/:presetId" element={<Navigate replace to="/content/home?tab=composition" />} />
    <Route path="globals/navigation" element={<NavigationPage />} />
    <Route path="globals/footer" element={<Navigate replace to="/globals/navigation?tab=footer" />} />
    <Route path="media" element={<MediaLibraryPage />} />
    <Route path="media/:assetId" element={<AssetPage />} />
    <Route path="components" element={<ManagementPage />} />
    <Route path="components/new" element={<ManagementPage mode="component" />} />
    <Route path="components/:blockId" element={<ManagementPage mode="component" />} />
    <Route path="code" element={<CapabilityRoute capability="canManageSiteCode"><CodePage /></CapabilityRoute>} />
    <Route path="code/new" element={<CapabilityRoute capability="canManageSiteCode"><CodePage /></CapabilityRoute>} />
    <Route path="code/:artifactId" element={<CapabilityRoute capability="canManageSiteCode"><CodePage /></CapabilityRoute>} />
    <Route path="seo" element={<SeoPage />} />
    <Route path="seo/pages/:nodeId" element={<SeoPage />} />
    <Route path="marketing/campaigns" element={<ManagementPage />} />
    <Route path="redirects" element={<CapabilityRoute capability="canManageRedirects"><RedirectsPage /></CapabilityRoute>} />
    <Route path="analytics/*" element={<CapabilityRoute capability="canViewAnalytics"><AnalyticsPage /></CapabilityRoute>} />
    <Route path="releases" element={<ReleasesPage />} />
    <Route path="releases/:releaseId" element={<ReleaseDetailPage />} />
    <Route path="settings/site" element={<CapabilityRoute capability="canManageSiteSettings"><SiteSettingsPage /></CapabilityRoute>} />
    <Route path="settings/integrations" element={<CapabilityRoute capability="canManageIntegrations"><IntegrationsPage /></CapabilityRoute>} />
    <Route path="settings/access" element={<CapabilityRoute capability="canViewContent"><AccessPage /></CapabilityRoute>} />
    <Route path="audit" element={<CapabilityRoute capability="canViewAudit"><ManagementPage /></CapabilityRoute>} />
    <Route path="menu" element={<MobileMenuPage />} />
    <Route path="dev/ui/admin" element={<AdminUiGalleryPage />} />
    <Route path="forbidden" element={<NotFoundPage denied />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Routes>
}

function CapabilityRoute({ capability, capabilities, children }: { capability?: keyof Capabilities; capabilities?: readonly (keyof Capabilities)[]; children: ReactNode }) {
  const { user } = useAdminAuthSession()
  const required = capabilities ?? (capability ? [capability] : [])
  return required.every((requiredCapability) => user.capabilities[requiredCapability] === true) ? children : <NotFoundPage denied />
}
