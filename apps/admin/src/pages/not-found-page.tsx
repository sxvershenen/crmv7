import { IconLock, IconSearch } from "@tabler/icons-react"
import { useLocation, useNavigate } from "react-router-dom"
import { PageFrame, PageState } from "@crm/ui"

export function NotFoundPage({ denied = false }: { denied?: boolean }) { const navigate = useNavigate(); const location = useLocation(); return <PageFrame><div className="rounded-xl border bg-background"><PageState actionLabel="Вернуться в CMS" icon={denied ? IconLock : IconSearch} onAction={() => navigate("/")} title={denied ? "Нет прав" : "Страница не найдена"}>{denied ? "Требуется capability для этого раздела. Отказ будет записан в audit." : `Маршрут ${location.pathname} не описан.`}</PageState></div></PageFrame> }
