import { OrderedStageList } from "@app/components/shared/ordered-stage-list"
import type { ProgramTemplateStage } from "@app/entities/programs"

export function ProgramStageList(props: { onChange: <K extends keyof ProgramTemplateStage>(id: string, key: K, value: ProgramTemplateStage[K]) => void; onDelete: (id: string) => void; onDuplicate: (stage: ProgramTemplateStage) => void; onMove: (from: number, to: number) => void; stages: ProgramTemplateStage[] }) {
  return <OrderedStageList {...props} testId="program-stage-list" />
}
