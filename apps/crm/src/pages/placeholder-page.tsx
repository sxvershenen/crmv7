import { IconArrowLeft, IconMapOff } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import { Button, IconBox, StatusBadge } from "@crm/ui"

export function PlaceholderPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      <div className="overflow-hidden rounded-xl border bg-surface-raised">
        <div className="flex min-h-14 items-center gap-3 border-b px-4">
          <Button aria-label="Назад" onClick={() => navigate(-1)} size="icon-sm" variant="ghost">
            <IconArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">404</p>
            <h2 className="truncate text-sm font-semibold">Страница не найдена</h2>
          </div>
          <StatusBadge tone="neutral">CRM</StatusBadge>
        </div>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
          <IconBox icon={IconMapOff} variant="neutral" />
          <div>
            <p className="text-sm font-semibold">Такого маршрута нет</p>
            <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
              Проверьте адрес или вернитесь на предыдущий экран. Рабочие CRM-разделы уже доступны в боковой навигации.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
