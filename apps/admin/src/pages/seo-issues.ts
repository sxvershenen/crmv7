import type { ContentNode } from "@admin/entities/cms"

export type SeoIssue = { field: string; message: string }

export function seoIssues(node: ContentNode): SeoIssue[] {
  if (!node.seo) return [{ field: "SEO", message: "У страницы нет рабочей редакции с SEO-данными" }]
  const issues: SeoIssue[] = []
  if (!node.seo.title.trim()) issues.push({ field: "SEO title", message: "Добавьте заголовок для поиска" })
  else if (node.seo.title.length > 60) issues.push({ field: "SEO title", message: `Заголовок длиннее 60 символов (${node.seo.title.length})` })
  if (!node.seo.description.trim()) issues.push({ field: "SEO description", message: "Добавьте описание для поиска" })
  else if (node.seo.description.length > 160) issues.push({ field: "SEO description", message: `Описание длиннее 160 символов (${node.seo.description.length})` })
  return issues
}
