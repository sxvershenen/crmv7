import React, { useState } from 'react';
import {
  Home,
  Flame,
  Sparkles,
  Layers,
  CalendarDays,
  Compass,
  MapPin,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Send,
  ArrowRight,
  ChevronDown
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenBookingModal: (itemName?: string) => void;
  onOpenCallModal: () => void;
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  megaTitle: string;
  megaDesc: string;
  subcategories: { title: string; desc: string; targetId: string }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  onOpenBookingModal,
  onOpenCallModal,
  onNavigate
}) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState(false);

  const menuItems: MenuItem[] = [
    {
      id: "houses",
      label: "Глэмпинг и дома",
      icon: <Home className="w-4 h-4 text-[#2B9E47]" />,
      badge: "2 дома",
      megaTitle: "Уютный глэмпинг в соснах",
      megaDesc: "Дизайнерские дома с панорамным видом, сибирским чаном и террасами.",
      subcategories: [
        { title: "Дом «Гнездо»", desc: "A-frame коттедж с личным чаном на 2–4 чел", targetId: "houses" },
        { title: "«Дом на дереве»", desc: "Шале на сваях на высоте 3м с проектором", targetId: "houses" },
        { title: "Условия и оснащение", desc: "Кухня, сатин, теплый пол, мангал", targetId: "houses" }
      ]
    },
    {
      id: "sauna",
      label: "Баня и чан",
      icon: <Flame className="w-4 h-4 text-[#EE2F2E]" />,
      megaTitle: "СПА-комплекс на живом огне",
      megaDesc: "Березовые дрова, пихта, цитрусы и аромат сибирского кедра.",
      subcategories: [
        { title: "Кедровая русская баня", desc: "Парная на дровах с купелью и самоваром", targetId: "sauna" },
        { title: "Сибирский чан с пихтой", desc: "Горячая купель под открытым небом 38-42°C", targetId: "sauna" },
        { title: "СПА-девичники и парение", desc: "Травяные сборы, мед, аромапарение", targetId: "sauna" }
      ]
    },
    {
      id: "programs",
      label: "Программы праздников",
      icon: <Sparkles className="w-4 h-4 text-[#FAAB2B]" />,
      badge: "80+ сюжетов",
      megaTitle: "Event-команда «Зажигай»",
      megaDesc: "Организация любых праздников «под ключ» без посредников.",
      subcategories: [
        { title: "Корпоративы и тимбилдинг", desc: "Форт Боярд, квизы, кулинарные баттлы", targetId: "programs" },
        { title: "Свадьбы на природе", desc: "Выездная регистрация и шатёр в соснах", targetId: "programs" },
        { title: "Выпускные и школьные", desc: "Лазертаг, TikTok-квесты, шоу программы", targetId: "programs" },
        { title: "Семейные дни рождения", desc: "Душевные сценарии для всех поколений", targetId: "programs" }
      ]
    },
    {
      id: "venues",
      label: "Площадки и залы",
      icon: <Layers className="w-4 h-4 text-[#18191b]" />,
      megaTitle: "Локации для любого формата",
      megaDesc: "От камерных беседок до масштабного банкетного зала и сцены.",
      subcategories: [
        { title: "Банкетный зал (до 150)", desc: "Панорамный светлый зал с профессиональным звуком", targetId: "venues" },
        { title: "Панорамная веранда (до 60)", desc: "Уютная крытая терраса с гирляндами", targetId: "venues" },
        { title: "Лесная беседка & Тёплая юрта", desc: "Мангал, печь-камин, уют для компании", targetId: "venues" }
      ]
    },
    {
      id: "events",
      label: "Ближайшие события",
      icon: <CalendarDays className="w-4 h-4 text-[#2B9E47]" />,
      megaTitle: "Афиша мероприятий",
      megaDesc: "Повод выбраться из города на выходные уже есть.",
      subcategories: [
        { title: "Музыкальные вечера", desc: "Живой звук и чай у костра на закате", targetId: "events" },
        { title: "Семейные квесты", desc: "Приключения по лесным тропам с подарками", targetId: "events" },
        { title: "Сообщество ВКонтакте", desc: "Горящие даты, скидки и фотоотчеты", targetId: "events" }
      ]
    },
    {
      id: "map",
      label: "Карта базы (12 га)",
      icon: <Compass className="w-4 h-4 text-[#18191b]" />,
      megaTitle: "Территория «Свистоплясово»",
      megaDesc: "12 гектаров соснового бора на берегу реки.",
      subcategories: [
        { title: "Интерактивная карта", desc: "Расположение домиков, бани и локаций", targetId: "map" },
        { title: "Костровище и качели", desc: "Зоны отдыха, лесные тропы и река", targetId: "map" }
      ]
    },
    {
      id: "location",
      label: "Как добраться и FAQ",
      icon: <MapPin className="w-4 h-4 text-[#18191b]" />,
      megaTitle: "30 минут от Кирова",
      megaDesc: "Асфальт до ворот, парковка на 60 авто, навигация.",
      subcategories: [
        { title: "Маршрут и навигатор", desc: "Яндекс.Карты, 2ГИС, трансфер", targetId: "location" },
        { title: "Частые вопросы (FAQ)", desc: "Дети, питомцы, заезд, чан, питание", targetId: "location" },
        { title: "Калькулятор отдыха", desc: "Рассчитать стоимость за 1 минуту", targetId: "quiz" }
      ]
    }
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-50 bg-white border-r border-neutral-100 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? 'w-[98px]' : 'w-[280px]'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-[72px] flex items-center justify-between px-5 border-b border-neutral-100 shrink-0">
        {!isCollapsed ? (
          <div 
            onClick={() => onNavigate('hero')}
            className="cursor-pointer flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-[#2B9E47] text-white flex items-center justify-center font-bold text-sm tracking-tighter">
              СВ
            </div>
            <div>
              <div className="text-[14px] font-semibold text-[#18191b] leading-none tracking-tight">
                СВИСТОПЛЯСОВО
              </div>
              <div className="text-[10px] text-[#6b7280] mt-0.5 font-medium">
                Глэмпинг & База отдыха
              </div>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => onNavigate('hero')}
            className="w-8 h-8 mx-auto rounded-xl bg-[#2B9E47] text-white flex items-center justify-center font-bold text-sm tracking-tighter cursor-pointer"
            title="Свистоплясово"
          >
            СВ
          </div>
        )}

        {/* Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-full bg-[#f7f7f7] hover:bg-neutral-200 text-[#18191b] flex items-center justify-center transition-colors"
          title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto overflow-x-visible py-3 px-3 space-y-1 relative no-scrollbar">
        {menuItems.map((item) => {
          const isHovered = hoveredItemId === item.id;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setHoveredItemId(item.id)}
              onMouseLeave={() => setHoveredItemId(null)}
            >
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-2xl text-[13px] font-medium transition-all group ${
                  isHovered ? 'bg-[#f7f7f7] text-[#18191b]' : 'text-[#2d3134] hover:bg-[#f7f7f7]'
                } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon with square pill wrapper */}
                  <div className="w-8 h-8 rounded-xl bg-[#f7f7f7] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    {item.icon}
                  </div>

                  {!isCollapsed && (
                    <span className="truncate text-left">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-[#6b7280]">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[#18191b] group-hover:translate-x-0.5 transition-all" />
                  </div>
                )}
              </button>

              {/* Mega-Menu Flyout (Visible on hover with high z-index) */}
              {isHovered && (
                <div 
                  className={`fixed ${
                    isCollapsed ? 'left-[106px]' : 'left-[288px]'
                  } top-auto w-[340px] bg-white rounded-3xl p-5 border border-neutral-200/70 shadow-2xl z-[100] animate-in fade-in slide-in-from-left-2 duration-150`}
                  style={{ top: 'max(80px, min(calc(100vh - 420px), 160px))' }}
                >
                  <div className="mb-3.5">
                    <div className="text-[10px] uppercase font-semibold text-[#2B9E47] tracking-wider mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2B9E47]"></span>
                      {item.label}
                    </div>
                    <div className="text-[15px] font-semibold text-[#18191b] leading-tight">
                      {item.megaTitle}
                    </div>
                    <p className="text-[12px] text-[#6b7280] mt-1 leading-snug">
                      {item.megaDesc}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                    {item.subcategories.map((sub, sIdx) => (
                      <div
                        key={sIdx}
                        onClick={() => {
                          onNavigate(sub.targetId);
                          setHoveredItemId(null);
                        }}
                        className="p-2.5 rounded-xl hover:bg-[#f7f7f7] cursor-pointer transition-colors group/sub"
                      >
                        <div className="text-[13px] font-medium text-[#18191b] flex items-center justify-between">
                          <span>{sub.title}</span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 opacity-0 group-hover/sub:opacity-100 group-hover/sub:translate-x-0.5 transition-all" />
                        </div>
                        <div className="text-[11px] text-[#6b7280] mt-0.5 leading-snug">
                          {sub.desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-neutral-100">
                    <button
                      onClick={() => {
                        onNavigate(item.id);
                        setHoveredItemId(null);
                      }}
                      className="w-full h-[36px] rounded-full bg-[#f7f7f7] hover:bg-neutral-200 text-[#18191b] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Перейти в раздел</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Bottom CTA Stack */}
      <div className="p-3 border-t border-neutral-100 space-y-2 shrink-0 bg-white">
        {!isCollapsed ? (
          <>
            {/* Primary Booking Button with Dropdown Methods */}
            <div className="relative">
              <button
                onClick={() => setBookingDropdownOpen(!bookingDropdownOpen)}
                className="w-full h-[42px] px-3.5 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium flex items-center justify-between hover:bg-[#23823a] transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  <span>Забронировать</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bookingDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown methods */}
              {bookingDropdownOpen && (
                <div className="absolute bottom-[48px] left-0 right-0 bg-white rounded-2xl p-2 border border-neutral-200 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setBookingDropdownOpen(false);
                      onOpenBookingModal();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#f7f7f7] text-left text-[12px] font-medium text-[#18191b]"
                  >
                    <Send className="w-3.5 h-3.5 text-[#2B9E47]" />
                    <span>Написать ВКонтакте</span>
                  </button>
                  <button
                    onClick={() => {
                      setBookingDropdownOpen(false);
                      onOpenCallModal();
                    }}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#f7f7f7] text-left text-[12px] font-medium text-[#18191b]"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#18191b]" />
                    <span>Позвонить по телефону</span>
                  </button>
                </div>
              )}
            </div>

            {/* Secondary: Call Modal Button (with 2 numbers) */}
            <button
              onClick={onOpenCallModal}
              className="w-full h-[38px] px-3.5 rounded-full bg-[#f7f7f7] text-[#18191b] text-[13px] font-medium flex items-center justify-between hover:bg-neutral-200 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#6b7280] group-hover:text-[#18191b]" />
                <span>Позвонить</span>
              </div>
              <span className="text-[11px] text-[#6b7280]">2 линии</span>
            </button>

            {/* Tertiary: VK Community Link */}
            <a
              href="https://vk.com"
              target="_blank"
              rel="noreferrer"
              className="w-full h-[38px] px-3.5 rounded-full bg-[#f7f7f7] text-[#18191b] text-[13px] font-medium flex items-center justify-between hover:bg-neutral-200 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-[#2B9E47] -rotate-12" />
                <span>Мы ВКонтакте</span>
              </div>
              <span className="text-[10px] font-semibold text-[#2B9E47] bg-[#2B9E47]/10 px-1.5 py-0.5 rounded-full">
                14.8k
              </span>
            </a>
          </>
        ) : (
          /* Collapsed Icons */
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={() => onOpenBookingModal()}
              className="w-10 h-10 rounded-full bg-[#2B9E47] text-white flex items-center justify-center hover:bg-[#23823a] transition-colors"
              title="Забронировать"
            >
              <Send className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenCallModal}
              className="w-10 h-10 rounded-full bg-[#f7f7f7] text-[#18191b] flex items-center justify-center hover:bg-neutral-200 transition-colors"
              title="Позвонить (2 номера)"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
