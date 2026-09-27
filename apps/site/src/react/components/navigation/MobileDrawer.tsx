import React, { useState } from 'react';
import { ChevronDown, X, Home, Flame, Sparkles, Layers, CalendarDays, Compass, MapPin, Phone, Send, Calculator } from 'lucide-react';
import type { SiteNavigationChild, SiteNavigationConfig, SiteNavigationItem } from '@crm/site-ui';
import { useDialogBehavior } from '../../utils/useDialogBehavior';
import { NavigationIcon } from './NavigationIcon';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenBookingModal: () => void;
  onOpenCallModal: () => void;
  navigation?: SiteNavigationConfig;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenBookingModal,
  onOpenCallModal,
  navigation,
}) => {
  const dialogRef = useDialogBehavior(isOpen, onClose);
  if (!isOpen) return null;

  const defaultLinks = [
    { id: "hero", label: "Главная страница", icon: <Home className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "houses", label: "Глэмпинг и домики", icon: <Sparkles className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "sauna", label: "Кедровая баня и чан", icon: <Flame className="w-4 h-4 text-[#EE2F2E]" /> },
    { id: "programs", label: "Программы праздников", icon: <Sparkles className="w-4 h-4 text-[#FAAB2B]" /> },
    { id: "venues", label: "Площадки и залы", icon: <Layers className="w-4 h-4 text-[#18191b]" /> },
    { id: "events", label: "Ближайшие события", icon: <CalendarDays className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "map", label: "Карта территории 12 га", icon: <Compass className="w-4 h-4 text-[#18191b]" /> },
    { id: "quiz", label: "Калькулятор отдыха", icon: <Calculator className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "location", label: "Как добраться и FAQ", icon: <MapPin className="w-4 h-4 text-[#18191b]" /> },
  ];
  const configuredLinks: SiteNavigationItem[] | null = navigation
    ? (navigation.mobileItems?.length ? navigation.mobileItems : navigation.items)
    : null;

  const followLink = (href: string, external?: boolean) => {
    onClose();
    if (!external && href.startsWith("/#")) {
      onNavigate(href.slice(2));
      return;
    }
    if (external) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(href);
  };

  return (
    <div className="lg:hidden fixed inset-0 z-[90]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-[rgba(23,32,26,0.4)]" aria-hidden="true" />
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Навигация по сайту"
        className="absolute inset-x-0 bottom-0 bg-surface rounded-t-2xl p-4 max-h-[85dvh] flex flex-col justify-between overflow-y-auto animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Top header */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[16px] font-semibold tracking-[-0.5px] text-ink">Меню</div>
            <button
              onClick={onClose}
              aria-label="Закрыть меню"
              className="icon-tile !w-9 !h-9"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Links list */}
          <div className="flex flex-col gap-1">
            {configuredLinks ? configuredLinks.map((link) => <MobileNavigationRow followLink={followLink} item={link} key={link.id} />) : defaultLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  onNavigate(link.id);
                  onClose();
                }}
                className="nav-item w-full !bg-bg text-left"
              >
                <div className="icon-tile !bg-surface !w-9 !h-9">
                  {link.icon}
                </div>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="pt-4 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenBookingModal();
            }}
            className="btn btn-primary w-full"
          >
            <Send className="w-4 h-4" />
            <span>Забронировать отдых</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenCallModal();
            }}
            className="btn btn-soft w-full"
          >
            <Phone className="w-4 h-4" />
            <span>Позвонить (2 номера)</span>
          </button>

          <a
            href="https://vk.com"
            target="_blank"
            rel="noreferrer"
            className="btn btn-soft w-full"
          >
            <Send className="w-3.5 h-3.5 text-[#2B9E47] -rotate-12" />
            <span>Сообщество ВКонтакте (14.8k)</span>
          </a>
        </div>
      </div>
    </div>
  );
};

function MobileNavigationRow({ item, followLink }: { item: SiteNavigationItem | SiteNavigationChild; followLink: (href: string, external?: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const children = item.children ?? [];
  const submenuId = `mobile-nav-${item.id}`;

  return <div>
    <div className="flex items-stretch gap-1">
      <button type="button" onClick={() => followLink(item.href, item.external)} className="nav-item min-w-0 flex-1 !bg-bg text-left">
        <span className="icon-tile !bg-surface !w-9 !h-9"><NavigationIcon icon={item.icon ?? "arrow-right"} color={item.color} /></span>
        <span className="min-w-0 truncate">{item.label}</span>
      </button>
      {children.length > 0 ? <button type="button" aria-controls={expanded ? submenuId : undefined} aria-expanded={expanded} aria-label={`${expanded ? "Скрыть" : "Показать"} подпункты: ${item.label}`} onClick={() => setExpanded((value) => !value)} className="icon-tile !w-11 !h-11 shrink-0 !bg-bg">
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button> : null}
    </div>
    {children.length > 0 && expanded ? <div id={submenuId} className="ml-4 border-l border-border pl-3 pt-1 flex flex-col gap-1">{children.map((child) => <MobileNavigationRow followLink={followLink} item={child} key={child.id} />)}</div> : null}
  </div>;
}
