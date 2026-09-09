import { Module } from "@nestjs/common"

import { ProgramsController } from "./programs.controller.js"
import { ProgramsService } from "./programs.service.js"
import { ProgramCategoriesService } from "./program-categories.service.js"

@Module({ controllers: [ProgramsController], providers: [ProgramsService, ProgramCategoriesService] })
export class ProgramsModule {}
