import { Module } from "@nestjs/common"
import { OfferingsModule } from "../offerings/offerings.module.js"

import { ProgramsController } from "./programs.controller.js"
import { ProgramsService } from "./programs.service.js"
import { ProgramCategoriesService } from "./program-categories.service.js"

@Module({ imports: [OfferingsModule], controllers: [ProgramsController], providers: [ProgramsService, ProgramCategoriesService] })
export class ProgramsModule {}
