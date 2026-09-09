# Public UI boundary

`@crm/site-ui` — единственная visual authority public site и отделена от operational `@crm/ui`.

- Начинать с текущего consumer и `component-inventory-v2.json`. `SITE_UI_KIT.md` читать для API/inventory, `07-phase-4-cms/PUBLIC-SITE-UI-KIT.md` — только при изменении architecture/UX contract.
- Import tokens через `@crm/site-ui/theme.css`, components из `@crm/site-ui`; page/managed Tailwind допустим только для structural placement.
- Не добавлять локальные palettes, type scales, radii, shadows, controls или cards. Отличающийся approved UI становится named variant, а не incidental normalization.
- Новый/изменённый pattern проходит `approved consumer → package export → real consumer → /dev/site-ui-v2 → visual/interaction coverage`; `sourceConsumer`/`sourceNeedle` обязательны.
- Astro владеет document и meaningful HTML. React добавлять только для реального interaction и гидратировать минимальный island.
- Media передаёт useful `alt` или `""`, dimensions/aspect ratio, responsive variants и focal point; production не ссылается на staging/original upload.
- Price, availability, capacity, eligibility и booking confirmation — только server/public-projection facts.
- `analyticsId` — stable semantic ID `{scope}.{section}.{action}[.{variant}]`, без PII и runtime entity values.
- Managed components не владеют canonical/robots/sitemap/schema: route metadata приходит из active release.
- Registry `src/section-registry.ts` — renderer allowlist; unknown keys отклоняются, а не исполняются динамически.

Проверять package/site typecheck, architecture gate, реальный consumer, `/dev/site-ui-v2`, desktop/mobile, keyboard, reduced motion и long-content states по риску изменения.
