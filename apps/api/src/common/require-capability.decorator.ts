import { SetMetadata } from "@nestjs/common"

import type { CapabilityName } from "@crm/contracts"

export const REQUIRED_CAPABILITIES = "requiredCapabilities"

export const RequireCapabilities = (...capabilities: CapabilityName[]) =>
  SetMetadata(REQUIRED_CAPABILITIES, capabilities)
