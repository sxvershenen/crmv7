import React, { useState } from 'react';
import { Car, Clock, HelpCircle, Mail, MapPin, Navigation, Phone, Send } from 'lucide-react';
import { Accordion, SiteSectionHeader } from '@crm/site-ui';
import { FAQ_ITEMS } from '../../data/resortData';

interface FaqLocationSectionProps { onOpenCallModal: () => void; }
const coords = { lat: 58.5532, lng: 49.6234 };
const route = `https://yandex.ru/maps/?rtext=~${coords.lat}%2C${coords.lng}&rtt=auto`;
const widget = `https://yandex.ru/map-widget/v1/?ll=${coords.lng}%2C${coords.lat}&z=12&pt=${coords.lng}%2C${coords.lat}%2Cpm2gnm`;

const ContactRow = ({ icon, label, value, href, onClick }: { icon: React.ReactNode; label: string; value: string; href?: string; onClick?: () => void }) => {
  const content = <><span className="icon-tile !w-9 !h-9 group-hover:bg-green-soft group-hover:text-green-deep transition-colors">{icon}</span><span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3"><span className="text-[11px] text-ink-3">{label}</span><span className="text-[13px] font-medium truncate">{value}</span></span></>;
  const cls = 'group flex items-center gap-3 px-2 py-2 rounded-[var(--site-radius-md)] hover:bg-bg transition-colors text-left';
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{content}</button>;
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={cls}>{content}</a>;
  return <div className={cls}>{content}</div>;
};

export const FaqLocationSection: React.FC<FaqLocationSectionProps> = ({ onOpenCallModal }) => {
  const [mapOn, setMapOn] = useState(false);
  return <section id="location" data-section-key="faq" className="w-full py-8">
    <SiteSectionHeader eyebrow="Полезное" eyebrowIcon={<HelpCircle className="w-3 h-3" />} eyebrowTone="brand" title={<>Как доехать и&nbsp;что спросить</>} description={<>Дорога занимает полчаса, а&nbsp;ответы на&nbsp;частые вопросы — минуту.</>} />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      <div className="lg:col-span-5 flex flex-col gap-3">
        <div className="relative rounded-[var(--site-radius-xl)] overflow-hidden aspect-[4/3] bg-green-soft group">
          {mapOn ? <iframe title="Карта проезда" src={widget} className="absolute inset-0 w-full h-full border-0" loading="lazy" allowFullScreen /> : <><img src="https://images.pexels.com/photos/34923437/pexels-photo-34923437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=500&w=800" alt="Карта: как доехать" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-80" /><span className="absolute inset-0 bg-black/20" /><button type="button" onClick={() => setMapOn(true)} className="absolute inset-0 flex items-center justify-center" aria-label="Загрузить интерактивную карту"><span className="btn btn-light group-hover:bg-green group-hover:text-white"><span>Открыть карту</span><span className="btn-arrow"><MapPin size={14} /></span></span></button><span className="absolute left-3 bottom-3 chip on-img text-[11px]">58.5532, 49.6234</span></>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <a href={route} target="_blank" rel="noreferrer" className="group bg-surface rounded-[var(--site-radius-xl)] p-3 flex items-center gap-3"><span className="icon-tile group-hover:bg-green-soft group-hover:text-green-deep transition-colors"><Navigation size={17} /></span><span className="min-w-0"><span className="block text-[13px] font-semibold tracking-[-.3px]">Маршрут</span><span className="block text-[11px] text-ink-3 truncate">Яндекс Навигатор</span></span></a>
          <div className="bg-surface rounded-[var(--site-radius-xl)] p-3 flex items-center gap-3"><span className="icon-tile"><Car size={17} /></span><span className="min-w-0"><span className="block text-[13px] font-semibold tracking-[-.3px]">30 минут</span><span className="block text-[11px] text-ink-3 truncate">38 км из Кирова</span></span></div>
        </div>
        <div className="bg-surface rounded-[var(--site-radius-xl)] p-2 flex flex-col">
          <ContactRow icon={<MapPin size={16} />} label="Адрес" value="дер. Свистоплясово" /><ContactRow icon={<Phone size={16} />} label="Бронирование" value="+7 (8332) 74-55-10" onClick={onOpenCallModal} /><ContactRow icon={<Send size={16} />} label="ВКонтакте" value="vk.com/svistoplyasovo" href="https://vk.com" /><ContactRow icon={<Mail size={16} />} label="Почта" value="info@svistoplyasovo.ru" href="mailto:info@svistoplyasovo.ru" /><ContactRow icon={<Clock size={16} />} label="Заезд / выезд" value="15:00 / 12:00" />
        </div>
      </div>
      <Accordion className="lg:col-span-7" defaultOpenIds={FAQ_ITEMS[0] ? [FAQ_ITEMS[0].id] : []} items={FAQ_ITEMS.map((faq) => ({ id: faq.id, title: faq.question, content: <p>{faq.answer}</p> }))} />
    </div>
  </section>;
};
