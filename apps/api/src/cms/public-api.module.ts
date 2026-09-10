import { Module } from "@nestjs/common"

import { PublicContentController } from "./public-content.controller.js"
import { PublicContentService } from "./public-content.service.js"
import { CmsSiteSettingsService } from "./cms-site-settings.service.js"
import { PublicSiteSettingsController } from "./public-site-settings.controller.js"
import { PublicMediaController } from "./public-media.controller.js"
import { MediaService } from "./media.service.js"
import { MediaStorageService } from "./media-storage.service.js"
import { PublicListingController } from "./public-listing.controller.js"
import { PublicListingService } from "./public-listing.service.js"
import { PublicAddonOfferingController } from "./public-addon-offering.controller.js"
import { PublicAddonOfferingService } from "./public-addon-offering.service.js"
import { PublicVenueOfferingController } from "./public-venue-offering.controller.js"
import { PublicVenueOfferingService } from "./public-venue-offering.service.js"

@Module({ controllers: [PublicContentController, PublicSiteSettingsController, PublicMediaController, PublicListingController, PublicAddonOfferingController, PublicVenueOfferingController], providers: [PublicContentService, CmsSiteSettingsService, MediaService, MediaStorageService, PublicListingService, PublicAddonOfferingService, PublicVenueOfferingService] })
export class PublicApiModule {}
