import { ArrowUpRight, Leaf, Mail, MapPin, Phone } from "lucide-react";
import { SiteFooterBrand, SiteFooterColumn, SiteFooterLegal, SiteFooterShell, type SiteNavigationItem } from "@crm/site-ui";

interface FooterProps { navigation?: SiteNavigationItem[] }

const fallback = [
  { label: "Глэмпинг", children: [{ label: "Домик «Гнездо» с чаном", href: "/#houses" }, { label: "Баня и чан", href: "/#sauna" }] },
  { label: "Мероприятия", children: [{ label: "Программы", href: "/#programs" }, { label: "Площадки", href: "/#venues" }] },
  { label: "Информация", children: [{ label: "Карта базы", href: "/#map" }, { label: "Вопросы", href: "/#location" }] },
];

export default function Footer({ navigation }: FooterProps) {
  const columns = (navigation?.length ? navigation : fallback).slice(0, 3);
  return (
    <SiteFooterShell data-section-key="footer">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6">
          <div className="lg:col-span-4 flex flex-col gap-5">
            <SiteFooterBrand mark={<Leaf size={18} />} title="Свистоплясово" subtitle="глэмпинг · Киров" description={<>Глэмпинг и&nbsp;площадка для событий в&nbsp;сосновом лесу, в&nbsp;30&nbsp;минутах от&nbsp;Кирова. Приезжайте — чайник уже стоит.</>} />
            <div className="flex flex-col gap-2 text-[length:var(--site-text-body-sm)]">
              <a href="tel:+78332745510" className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Phone size={14} className="text-[var(--site-color-brand-500)]" />+7 (8332) 74-55-10 <span className="text-[var(--site-color-text-inverse-muted)]">· бронь</span></a>
              <a href="tel:+79229953322" className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Phone size={14} className="text-[var(--site-color-brand-500)]" />+7 (922) 995-33-22 <span className="text-[var(--site-color-text-inverse-muted)]">· мероприятия</span></a>
              <a href="mailto:info@svistoplyasovo.ru" className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Mail size={14} className="text-[var(--site-color-brand-500)]" />info@svistoplyasovo.ru</a>
              <span className="inline-flex items-center gap-2.5"><MapPin size={14} className="text-[var(--site-color-brand-500)]" />Кировская область, д. Свистоплясово</span>
            </div>
            <a href="https://vk.com/svistoplyasovo" target="_blank" rel="noreferrer" className="btn btn-primary w-fit"><span>Мы ВКонтакте</span><span className="btn-arrow"><ArrowUpRight size={14} /></span></a>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-6">
            {columns.map((column) => (
              <SiteFooterColumn key={column.label} title={column.label}>{column.children.map((link) => <li key={`${link.label}:${link.href}`}><a href={link.href} target={'external' in link && link.external ? '_blank' : undefined} rel={'external' in link && link.external ? 'noreferrer' : undefined} className="group inline-flex items-center gap-1 hover:text-[var(--site-color-text-inverse)] transition-colors">{link.label}<ArrowUpRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" /></a></li>)}</SiteFooterColumn>
            ))}
          </div>
        </div>

        <SiteFooterLegal>
          <div><span className="block">ИП Норсеева Ирина Михайловна</span><span className="block">ИНН: 431900639521</span></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 lg:ml-auto"><a href="/privacy" data-site-action="privacy" className="hover:text-[var(--site-color-text-inverse)] hover:underline underline-offset-4">Политика обработки персональных данных</a><a href="/privacy" data-site-action="privacy" className="hover:text-[var(--site-color-text-inverse)] hover:underline underline-offset-4">Согласие на обработку данных</a></div>
          <span>© {new Date().getFullYear()} «Свистоплясово»</span>
        </SiteFooterLegal>
    </SiteFooterShell>
  );
}
