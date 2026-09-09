import { useRef, useState } from "react";
import { ArrowRight, CalendarCheck, ChevronLeft, Leaf, Phone, Send } from "lucide-react";
import type { SiteBrandConfig, SiteNavigationItem } from "@crm/site-ui";
import { DEFAULT_PUBLIC_NAVIGATION } from "../../../data/publicContentDefaults";
import { NavigationIcon } from "./NavigationIcon";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenBookingModal: (itemName?: string) => void;
  onOpenCallModal: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  brand?: SiteBrandConfig;
  items?: SiteNavigationItem[];
  configuredColors?: boolean;
}

/** CMS-backed port of attached components/layout/Sidebar.tsx. */
export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onOpenBookingModal,
  onOpenCallModal,
  onNavigate,
  brand = DEFAULT_PUBLIC_NAVIGATION.brand,
  items = DEFAULT_PUBLIC_NAVIGATION.items,
  configuredColors = false,
}: SidebarProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (href: string, external?: boolean) => {
    if (!external && href.startsWith("/#")) onNavigate(href.slice(2));
    else if (external) window.open(href, "_blank", "noopener,noreferrer");
    else window.location.assign(href);
  };
  const keep = () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); };
  const closeSoon = () => { leaveTimer.current = setTimeout(() => setHovered(null), 180); };

  return (
    <aside aria-label="Основная навигация" className="hidden lg:flex fixed left-0 top-0 h-dvh z-[60] bg-surface flex-col" style={{ width: isCollapsed ? "98px" : "280px", transition: "width .5s var(--ease-out)" }} onMouseLeave={() => { setHovered(null); setBookingOpen(false); }}>
      <button type="button" onClick={onToggleCollapse} aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"} className="absolute -right-4 top-7 w-8 h-8 rounded-full bg-surface text-ink inline-flex items-center justify-center hover:bg-green hover:text-white transition-colors z-10">
        <ChevronLeft size={16} className={`transition-transform duration-500 ${isCollapsed ? "rotate-180" : ""}`} />
      </button>

      <button type="button" onClick={() => go(brand.href)} className={`flex items-center gap-3 px-6 h-[88px] shrink-0 group text-left ${isCollapsed ? "justify-center !px-0" : ""}`}>
        <span className="icon-tile !bg-green !text-white !w-10 !h-10 group-hover:-rotate-[8deg] transition-transform duration-500" style={configuredColors ? { backgroundColor: brand.color } : undefined} aria-label={brand.mark}><Leaf size={19} /></span>
        {!isCollapsed ? <span className="flex flex-col whitespace-nowrap overflow-hidden"><span className="text-[15px] font-semibold tracking-[-.5px] leading-none">{brand.title}</span><span className="text-[11px] text-ink-3 mt-1">{brand.subtitle}</span></span> : null}
      </button>

      <nav className="flex-1 px-4 pt-2 flex flex-col gap-1">
        {items.map((item) => {
          const open = hovered === item.id;
          return <div key={item.id} className="relative" onMouseEnter={() => { keep(); setHovered(item.id); }} onMouseLeave={closeSoon}>
            <button type="button" onClick={() => go(item.href, item.external)} className={`nav-item w-full ${open ? "open" : ""} ${isCollapsed ? "justify-center !px-0" : ""}`} title={isCollapsed ? item.label : undefined}>
              <span className="icon-tile"><NavigationIcon icon={item.icon} color={configuredColors ? item.color : undefined} /></span>
              {!isCollapsed ? <><span className="flex-1 whitespace-nowrap text-left">{item.label}</span><ArrowRight size={13} className={`text-ink-3 transition-all duration-300 ${open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"}`} /></> : null}
            </button>
            {open && item.children.length ? <div className="absolute left-full top-0 pl-3 z-[70]" onMouseEnter={keep} onMouseLeave={closeSoon}><div className="dropdown-panel !p-2 w-[300px] shadow-xl"><div className="flex items-center gap-3 px-3 pt-2 pb-3"><span className="icon-tile !bg-green-soft !text-green-deep"><NavigationIcon icon={item.icon} /></span><div><div className="text-[14px] font-semibold tracking-[-.4px]">{item.label}</div></div></div><div className="hair mx-3 mb-1" />{item.children.map((child) => <button key={child.id} type="button" onClick={() => { setHovered(null); go(child.href, child.external); }} className="dropdown-item justify-between group/i"><span>{child.label}</span><ArrowRight size={13} className="opacity-0 -translate-x-1 group-hover/i:opacity-100 group-hover/i:translate-x-0 transition-all" /></button>)}</div></div> : null}
          </div>;
        })}
      </nav>

      <div className={`px-4 pb-5 pt-3 flex flex-col gap-2 ${isCollapsed ? "items-center" : ""}`}>
        <div className="relative w-full">
          <button type="button" onClick={() => setBookingOpen((value) => !value)} className={`btn btn-primary w-full ${isCollapsed ? "!px-0 !w-11 mx-auto" : "justify-between"}`} title="Забронировать">{isCollapsed ? <CalendarCheck size={17} /> : <><span>Забронировать</span><span className="btn-arrow"><ArrowRight size={15} /></span></>}</button>
          {bookingOpen ? <div className={`dropdown-panel absolute z-[70] w-[240px] shadow-xl ${isCollapsed ? "left-full bottom-0 ml-3" : "left-0 bottom-[calc(100%+6px)]"}`}><div className="px-3 pt-2 pb-2 text-[11px] text-ink-3">Как удобнее забронировать?</div><button type="button" onClick={() => { setBookingOpen(false); onOpenBookingModal(); }} className="dropdown-item"><span className="icon-tile !w-7 !h-7 !rounded-xs"><Send size={13} /></span>Написать ВКонтакте</button><button type="button" onClick={() => { setBookingOpen(false); onOpenCallModal(); }} className="dropdown-item"><span className="icon-tile !w-7 !h-7 !rounded-xs"><Phone size={13} /></span>Позвонить</button></div> : null}
        </div>
        <button type="button" onClick={onOpenCallModal} className={`btn btn-soft w-full ${isCollapsed ? "!px-0 !w-11 mx-auto" : "justify-between"}`} title="Позвонить">{isCollapsed ? <Phone size={17} /> : <><span>Позвонить</span><span className="btn-arrow"><Phone size={13} /></span></>}</button>
        <a href="https://vk.com/svistoplyasovo" target="_blank" rel="noreferrer" className={`btn btn-soft w-full ${isCollapsed ? "!px-0 !w-11 mx-auto" : "justify-between"}`} title="Мы ВКонтакте">{isCollapsed ? <span className="text-[11px] font-semibold">VK</span> : <><span>Мы ВКонтакте</span><span className="btn-arrow text-[10px]">VK</span></>}</a>
      </div>
    </aside>
  );
}
