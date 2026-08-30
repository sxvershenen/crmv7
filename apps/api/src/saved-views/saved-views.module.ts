import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"

import { SavedViewEntity } from "@crm/db"

import { SavedViewsController } from "./saved-views.controller.js"
import { SavedViewsService } from "./saved-views.service.js"

@Module({
  imports: [TypeOrmModule.forFeature([SavedViewEntity])],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
})
export class SavedViewsModule {}
