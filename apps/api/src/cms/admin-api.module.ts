import { Module } from "@nestjs/common"

import { AuthController } from "../auth/auth.controller.js"
import { AuthModule } from "../auth/auth.module.js"
import { DeliveryAdminController } from "../delivery/delivery-admin.controller.js"
import { DeliveryAdminService } from "../delivery/delivery-admin.service.js"
import { OfferingsAdminModule } from "../offerings/offerings-admin.module.js"

import { CmsContentController } from "./cms-content.controller.js"
import { CmsContentService } from "./cms-content.service.js"
import { CmsDashboardController } from "./cms-dashboard.controller.js"
import { CmsDashboardService } from "./cms-dashboard.service.js"
import { CmsPreviewController } from "./cms-preview.controller.js"
import { CmsPublicationController } from "./cms-publication.controller.js"
import { CmsPublicationService } from "./cms-publication.service.js"
import { PublicContentService } from "./public-content.service.js"
import { CmsSiteSettingsController } from "./cms-site-settings.controller.js"
import { CmsSiteSettingsService } from "./cms-site-settings.service.js"
import { MediaController } from "./media.controller.js"
import { MediaService } from "./media.service.js"
import { MediaStorageService } from "./media-storage.service.js"

@Module({
  // CMS and CRM deliberately expose the same cookie-session transport under
  // their own API roots. AuthModule remains the sole owner of sessions,
  // credentials and audit records; this module only mounts its controller at
  // /api/admin/v1/auth so the CMS never has to reach across to the internal
  // namespace.
  imports: [AuthModule, OfferingsAdminModule],
  controllers: [
    AuthController,
    CmsContentController,
    CmsDashboardController,
    CmsPreviewController,
    CmsPublicationController,
    CmsSiteSettingsController,
    MediaController,
    DeliveryAdminController,
  ],
  providers: [
    CmsContentService,
    CmsDashboardService,
    CmsPublicationService,
    CmsSiteSettingsService,
    PublicContentService,
    MediaService,
    MediaStorageService,
    DeliveryAdminService,
  ],
  exports: [PublicContentService],
})
export class AdminApiModule {}
