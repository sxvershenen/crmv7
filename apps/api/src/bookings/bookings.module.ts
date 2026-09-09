import { Module } from "@nestjs/common"
import { OfferingsModule } from "../offerings/offerings.module.js"
import { BookingsController } from "./bookings.controller.js"
import { BookingsService } from "./bookings.service.js"
import { MarketingModule } from "../marketing/marketing.module.js"
@Module({ imports: [OfferingsModule, MarketingModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
