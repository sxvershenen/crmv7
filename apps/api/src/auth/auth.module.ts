import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"

import { SessionEntity, UserEntity } from "@crm/db"

import { AuthController } from "./auth.controller.js"
import { AuthService } from "./auth.service.js"

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SessionEntity])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
