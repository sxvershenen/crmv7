import { ArrowUpRight, Leaf, Mail, MapPin, Phone } from "lucide-react";
import { DEFAULT_CMS_FOOTER_DETAILS, type CmsFooterDetails } from "@crm/contracts";
import { SiteFooterBrand, SiteFooterColumn, SiteFooterLegal, SiteFooterShell, type SiteNavigationChild, type SiteNavigationItem } from "@crm/site-ui";

interface FooterProps { navigation?: SiteNavigationItem[]; details?: CmsFooterDetails; siteName?: string }
interface FooterColumn { label: string; href?: string; external?: boolean; children: Pick<SiteNavigationChild, 'label' | 'href' | 'external' | 'children'>[] }

const fallback: FooterColumn[] = [
  { label: "Глэмпинг", children: [{ label: "Домик «Гнездо» с чаном", href: "/#houses" }, { label: "Баня и чан", href: "/#sauna" }] },
  { label: "Мероприятия", children: [{ label: "Программы", href: "/#programs" }, { label: "Площадки", href: "/#venues" }] },
  { label: "Информация", children: [{ label: "Карта базы", href: "/#map" }, { label: "Вопросы", href: "/#location" }] },
];

export default function Footer({ navigation, details = DEFAULT_CMS_FOOTER_DETAILS, siteName = "Свистоплясово" }: FooterProps) {
  const columns: FooterColumn[] = navigation ?? fallback;
  const phoneHref = (value: string) => `tel:${value.replace(/[^+\d]/g, "")}`;
  return (
    <SiteFooterShell data-section-key="footer">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6">
          <div className="lg:col-span-4 flex flex-col gap-5">
            <SiteFooterBrand mark={<Leaf size={18} />} title={siteName} subtitle={details.subtitle} description={details.description} />
            <div className="flex flex-col gap-2 text-[length:var(--site-text-body-sm)]">
              {details.bookingPhone && <a href={phoneHref(details.bookingPhone)} className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Phone size={14} className="text-[var(--site-color-brand-500)]" />{details.bookingPhone} <span className="text-[var(--site-color-text-inverse-muted)]">· бронь</span></a>}
              {details.eventsPhone && <a href={phoneHref(details.eventsPhone)} className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Phone size={14} className="text-[var(--site-color-brand-500)]" />{details.eventsPhone} <span className="text-[var(--site-color-text-inverse-muted)]">· мероприятия</span></a>}
              {details.email && <a href={`mailto:${details.email}`} className="inline-flex items-center gap-2.5 hover:text-[var(--site-color-brand-500)] transition-colors"><Mail size={14} className="text-[var(--site-color-brand-500)]" />{details.email}</a>}
              {details.address && <span className="inline-flex items-center gap-2.5"><MapPin size={14} className="text-[var(--site-color-brand-500)]" />{details.address}</span>}
            </div>
            {details.socialUrl && details.socialLabel && <a href={details.socialUrl} target="_blank" rel="noreferrer" className="btn btn-primary w-fit"><span>{details.socialLabel}</span><span className="btn-arrow"><ArrowUpRight size={14} /></span></a>}
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-6">
            {columns.map((column) => (
              <SiteFooterColumn key={column.label} title={column.href ? <a href={column.href} target={column.external ? '_blank' : undefined} rel={column.external ? 'noreferrer' : undefined} className="hover:underline underline-offset-4">{column.label}</a> : column.label}>
                {column.children.map((link) => <li key={`${link.label}:${link.href}`}>
                  <a href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} className="group inline-flex items-center gap-1 hover:text-[var(--site-color-text-inverse)] transition-colors">{link.label}<ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 group-hover:-rotate-45 transition-all" /></a>
                  {link.children?.length ? <ul className="mt-2 ml-3 flex flex-col gap-2 pl-3">{link.children.map((nested) => <li key={`${nested.label}:${nested.href}`}><a href={nested.href} target={nested.external ? '_blank' : undefined} rel={nested.external ? 'noreferrer' : undefined} className="hover:text-[var(--site-color-text-inverse)] transition-colors">{nested.label}</a></li>)}</ul> : null}
                </li>)}
              </SiteFooterColumn>
            ))}
          </div>
        </div>

        <SiteFooterLegal>
          <div>{details.legalName && <span className="block">{details.legalName}</span>}{details.inn && <span className="block">ИНН: {details.inn}</span>}</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 lg:ml-auto"><a href="/privacy" data-site-action="privacy" className="hover:text-[var(--site-color-text-inverse)] hover:underline underline-offset-4">Политика обработки персональных данных</a><a href="/privacy" data-site-action="privacy" className="hover:text-[var(--site-color-text-inverse)] hover:underline underline-offset-4">Согласие на обработку данных</a></div>
          <span>© {new Date().getFullYear()} «{siteName}»</span>
        </SiteFooterLegal>
    </SiteFooterShell>
  );
}
