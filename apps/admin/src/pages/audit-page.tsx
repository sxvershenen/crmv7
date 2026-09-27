import { IconHistory } from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { PageFrame, PageState } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"

export function AuditPage() {
  return <PageFrame>
    <PageHeading description="История действий сотрудников в CMS." title="Журнал изменений" />
    <PageState icon={IconHistory} title="Журнал действий пока недоступен">
      Серверный журнал для этого раздела ещё не подключён. Опубликованные изменения можно посмотреть в <Link className="text-primary underline underline-offset-2" to="/releases">истории публикаций</Link>.
    </PageState>
  </PageFrame>
}
