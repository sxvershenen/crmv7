import {
  ArticleCard,
  SiteActionSectionHeader,
  SiteListingRail,
  SiteSecondaryAction,
} from "@crm/site-ui"
import { FEATURED_BLOG_ARTICLES, MORE_BLOG_ARTICLES } from "../../data/blogData"

export function BlogSectionIsland() {
  return <section id="blog" data-section-key="blog" data-analytics-id="home.blog.view" className="site-section site-section--compact">
    <SiteActionSectionHeader
      title="Идеи и советы"
      action={<SiteSecondaryAction href="/blog" analyticsId="home.blog.open">Перейти</SiteSecondaryAction>}
    />
    <SiteListingRail label="Избранные материалы" columns={4}>
      {FEATURED_BLOG_ARTICLES.map((article, index) => <ArticleCard
        key={article.id}
        href="/blog"
        title={article.title}
        description={article.description}
        category={article.category}
        analyticsId={`home.blog.card-${index + 1}`}
        media={{ src: article.photo ?? "", alt: "", width: 800, height: 560, loading: "lazy" }}
      />)}
    </SiteListingRail>

    <div className="site-article-list hidden lg:grid grid-cols-2 gap-3 mt-4">
      {MORE_BLOG_ARTICLES.slice(0, 8).map((article, index) => <ArticleCard
        key={article.id}
        href="/blog"
        title={article.title}
        description={article.description}
        compact
        analyticsId={`home.blog.compact-${index + 1}`}
      />)}
    </div>
  </section>
}

export default BlogSectionIsland
