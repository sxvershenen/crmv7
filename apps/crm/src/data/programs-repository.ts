import { useFixtureData } from "@app/lib/data-mode"
import { ApiProgramsRepository } from "./api-programs-repository.js"
import { FixtureProgramsRepository } from "./fixture-programs-repository.js"
import type { FullProgramsRepository } from "./programs-repository-model.js"

export {
  createEmptyProgramCategory,
  createEmptyProgramRegistration,
  createEmptyProgramRun,
  createEmptyProgramTemplate,
  selectPrograms,
  type FullProgramsRepository,
  type ProgramCategoryEditorRepository,
  type ProgramOfferingResolution,
  type ProgramPriceBookDraftInput,
  type ProgramQuotePreviewInput,
  type ProgramRegistrationEditorRepository,
  type ProgramRunEditorRepository,
  type ProgramsRepository,
  type ProgramTemplateEditorRepository,
} from "./programs-repository-model.js"
export { ApiProgramsRepository } from "./api-programs-repository.js"
export { FixtureProgramsRepository } from "./fixture-programs-repository.js"

export const fixtureProgramsRepository: FullProgramsRepository = new FixtureProgramsRepository()
export const apiProgramsRepository: FullProgramsRepository = new ApiProgramsRepository()
export const programsRepository: FullProgramsRepository = useFixtureData ? fixtureProgramsRepository : apiProgramsRepository
