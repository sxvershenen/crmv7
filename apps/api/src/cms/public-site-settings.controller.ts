import { Controller, Get, Inject } from "@nestjs/common"
import { Public } from "../common/public.decorator.js"
import { CmsSiteSettingsService } from "./cms-site-settings.service.js"

@Public()
@Controller("site-settings")
export class PublicSiteSettingsController {
  constructor(@Inject(CmsSiteSettingsService) private readonly service: CmsSiteSettingsService) {}
  @Get() get() { return this.service.publicSnapshot() }
}
