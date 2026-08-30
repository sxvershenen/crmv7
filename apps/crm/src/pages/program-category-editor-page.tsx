import { CategoryEditor } from "@app/components/shared/category-editor"
import { formatProgramDateTime } from "@app/components/programs/program-format"
import { ProgramIcon } from "@app/components/programs/program-presentation"
import { programIconOptions, programToneOptions } from "@app/components/programs/program-presentation-data"
import { createEmptyProgramCategory, programsRepository, type ProgramCategoryEditorRepository } from "@app/data/programs-repository"
import type { ProgramCategoryEditorRecord } from "@app/entities/programs"

const renderIcon = (category: ProgramCategoryEditorRecord, size: "sm" | "md" = "sm") => <ProgramIcon icon={category.icon} size={size} tone={category.tone} />
const relatedItems = (category: ProgramCategoryEditorRecord) => category.relatedTemplates.map((template) => ({ href: `/programs/${template.id}`, id: template.id, label: template.name, secondary: template.nextRun ? `Следующее проведение: ${formatProgramDateTime(template.nextRun.startsAt)}` : "Проведение не назначено" }))

export function ProgramCategoryEditorPage({ repository = programsRepository }: { repository?: ProgramCategoryEditorRepository }) {
  return <CategoryEditor createEmpty={createEmptyProgramCategory} entityLabel="Категория программ" iconOptions={programIconOptions} listPath="/programs/categories" relatedItems={relatedItems} relatedLabel="Шаблоны" renderIcon={renderIcon} repository={repository} tone="program" toneOptions={programToneOptions} usageCount={(category) => category.templateCount} usageLabel="Шаблонов" />
}
