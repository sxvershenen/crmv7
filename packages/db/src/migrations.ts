import { InitialSchema1788112000000 } from "./migrations/1788112000000-initial-schema.js"
import { AlignCoreConstraints1788112400000 } from "./migrations/1788112400000-align-core-constraints.js"
import { BookingItemsPaymentTypes1788112800000 } from "./migrations/1788112800000-booking-items-payment-types.js"
import { IdempotencyKeys1788113200000 } from "./migrations/1788113200000-idempotency-keys.js"
import { CustomersLeads1788113600000 } from "./migrations/1788113600000-customers-leads.js"
import { ProgramsEvents1788114000000 } from "./migrations/1788114000000-programs-events.js"
import { BookingLeadLinks1788114400000 } from "./migrations/1788114400000-booking-lead-links.js"
import { ProgramEventCategories1788114800000 } from "./migrations/1788114800000-program-event-categories.js"
import { NotificationReads1788115200000 } from "./migrations/1788115200000-notification-reads.js"
import { WorkspaceProfileSettings1788115600000 } from "./migrations/1788115600000-workspace-profile-settings.js"
import { PaymentTargets1788116000000 } from "./migrations/1788116000000-payment-targets.js"
import { WorkspaceSettingsAuditShape1788116400000 } from "./migrations/1788116400000-workspace-settings-audit-shape.js"
import { CmsContentReleases1788116800000 } from "./migrations/1788116800000-cms-content-releases.js"
import { CmsDirectPublishing1788117200000 } from "./migrations/1788117200000-cms-direct-publishing.js"
import { MediaPlatform1788117600000 } from "./migrations/1788117600000-media-platform.js"
import { OfferingCatalogFoundation1788118000000 } from "./migrations/1788118000000-offering-catalog-foundation.js"
import { OfferingPricingRuntime1788118400000 } from "./migrations/1788118400000-offering-pricing-runtime.js"
import { OfferingConfigurationRuntime1788118800000 } from "./migrations/1788118800000-offering-configuration-runtime.js"
import { OperationalQuoteAcceptance1788119200000 } from "./migrations/1788119200000-operational-quote-acceptance.js"
import { OutboxDeliveryRuntime1788119600000 } from "./migrations/1788119600000-outbox-delivery-runtime.js"
import { CatalogOfferingEditorialLocator1788120000000 } from "./migrations/1788120000000-catalog-offering-editorial-locator.js"
import { CampgroundOfferingIntegrity1788120400000 } from "./migrations/1788120400000-campground-offering-integrity.js"
import { AddonOperationalDossier1788120800000 } from "./migrations/1788120800000-addon-operational-dossier.js"
import { RecurringWeekdayPriceRules1788121200000 } from "./migrations/1788121200000-recurring-weekday-price-rules.js"
import { BookingItemAddons1788121600000 } from "./migrations/1788121600000-booking-item-addons.js"
import { CompositeQuoteAcceptance1788122000000 } from "./migrations/1788122000000-composite-quote-acceptance.js"
import { MarketingPromotions1788122400000 } from "./migrations/1788122400000-marketing-promotions.js"
import { ProgramOfferingCore1788122800000 } from "./migrations/1788122800000-program-offering-core.js"

/** Canonical ordered migration registry shared by the CLI, seed and API runtime. */
export const databaseMigrations = [
  InitialSchema1788112000000,
  AlignCoreConstraints1788112400000,
  BookingItemsPaymentTypes1788112800000,
  IdempotencyKeys1788113200000,
  CustomersLeads1788113600000,
  ProgramsEvents1788114000000,
  BookingLeadLinks1788114400000,
  ProgramEventCategories1788114800000,
  NotificationReads1788115200000,
  WorkspaceProfileSettings1788115600000,
  PaymentTargets1788116000000,
  WorkspaceSettingsAuditShape1788116400000,
  CmsContentReleases1788116800000,
  CmsDirectPublishing1788117200000,
  MediaPlatform1788117600000,
  OfferingCatalogFoundation1788118000000,
  OfferingPricingRuntime1788118400000,
  OfferingConfigurationRuntime1788118800000,
  OperationalQuoteAcceptance1788119200000,
  OutboxDeliveryRuntime1788119600000,
  CatalogOfferingEditorialLocator1788120000000,
  CampgroundOfferingIntegrity1788120400000,
  AddonOperationalDossier1788120800000,
  RecurringWeekdayPriceRules1788121200000,
  BookingItemAddons1788121600000,
  CompositeQuoteAcceptance1788122000000,
  MarketingPromotions1788122400000,
  ProgramOfferingCore1788122800000,
]
