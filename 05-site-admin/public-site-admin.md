# Public site и technical/content admin — будущая фаза

## Public site

Astro получает только public API:
- published resources;
- descriptions/images/features;
- programs/promotions;
- public prices;
- aggregated availability при необходимости;
- SEO data.

Форма сайта создаёт Lead + contact + desired dates + direction + guests + comment + source + UTM + consent metadata.
Не создаёт confirmed Booking автоматически.

Public API: rate limiting, anti-spam, server validation, sanitization, минимальный набор полей, request tracing.

## Admin

Отдельный интерфейс на том же backend для content/SEO/media/reference data/users/roles/integrations/publication/system settings.
Не дублирует ежедневную операционную работу CRM.

Будущие сущности при необходимости: `ContentPage`, `ContentBlock`, `MediaAsset`, `SeoMeta`, `Promotion`, `PublicResourceProfile`, `SystemSetting`, `IntegrationSetting`.

Admin использует ту же дизайн-систему, а не параллельный UI kit.
