import type { CmsSiteSettingsDetail } from "@crm/contracts"

export function siteSettingsChanges(detail: CmsSiteSettingsDetail): string[] {
  if (!detail.draft) return []
  if (!detail.published) return ["Первый выпуск настроек сайта"]
  const fields = [
    ["siteName", "Название сайта"], ["headerNavigation", "Меню шапки"], ["mobileNavigation", "Меню телефона"],
    ["footerNavigation", "Нижнее меню"], ["headerCta", "Кнопка в шапке"],
    ["heroDefault", "Общий первый экран"], ["sectionDefaults", "Секции по умолчанию"],
  ] as const
  return fields.filter(([key]) => JSON.stringify(detail.draft!.value[key]) !== JSON.stringify(detail.published!.value[key])).map(([, label]) => label)
}
