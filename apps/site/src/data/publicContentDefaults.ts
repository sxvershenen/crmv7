import type { SiteHeroConfig, SiteNavigationConfig } from "@crm/site-ui"
import type { CmsHomeSectionConfig, CmsHomeSectionKey, CmsPartnersSectionConfig, CmsWhyUsSectionConfig } from "@crm/contracts"
import { PARTNERS_LIST, RESORT_IMAGES, WHY_US_FACTS } from "./resortData"

export const DEFAULT_WHY_US_CONFIG: CmsWhyUsSectionConfig = {
  eyebrow: "Почему мы",
  title: "Почему выбирают нас",
  description: "Конкретные доказательства вместо общих эпитетов. Всё, что можно посчитать, — посчитали.",
  facts: WHY_US_FACTS.map((fact) => ({ id: fact.id, number: fact.number, title: fact.title, description: fact.desc })),
  team: {
    label: "Команда «Зажигай»",
    title: "Профессиональная команда рядом на каждом этапе",
    description: "Проживание и событие в одном месте: гости не разъезжаются по домам, а идут спать в домики.",
  },
}

export const DEFAULT_PARTNERS_CONFIG: CmsPartnersSectionConfig = {
  title: "Наши партнёры",
  description: "Дружим с теми, кто делает вкусно, красиво и по-настоящему",
  items: PARTNERS_LIST.map((label, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, label })),
}

export const DEFAULT_HOMEPAGE_SECTION_CONFIGS: Record<CmsHomeSectionKey, CmsHomeSectionConfig> = {
  events: { eyebrow: "Афиша на весну", title: "Ближайшие события", description: "Повод выбраться из города на свежий воздух уже есть — присоединяйтесь к нашим душевным встречам", action: null },
  houses: { eyebrow: "Глэмпинг в лесу", title: "Домики для отдыха", description: "Панорамный A-frame с личным чаном на террасе или воздушный дом на дереве с видом на реку", action: null },
  "sauna-chan": { eyebrow: "СПА и здоровье", title: "Баня и горячий чан", description: "Целебный хвойный пар, березовые веники и горячая купель с пихтой прямо под открытым небом", action: null },
  programs: { eyebrow: null, title: "Программы и направления", description: "", action: null },
  venues: { eyebrow: null, title: "Площадки", description: "", action: null },
  blog: { eyebrow: null, title: "Идеи и советы", description: "", action: { label: "Перейти", href: "/blog" } },
  reviews: { eyebrow: "Доверие", title: "Отзывы гостей", description: "Только проверенные отзывы с Яндекс Карт и живое видео с площадки — без монтажа и прикрас.", action: null },
  map: { eyebrow: "Схема", title: "Карта базы", description: "Нажмите на кругляш — покажем, что это за строение и где оно стоит.", action: null },
  faq: { eyebrow: "Полезное", title: "Как доехать и что спросить", description: "Дорога занимает полчаса, а ответы на частые вопросы — минуту.", action: null },
  directions: { eyebrow: "Полезное", title: "Как доехать и что спросить", description: "Дорога занимает полчаса, а ответы на частые вопросы — минуту.", action: null },
  calculator: { eyebrow: "Расчёт", title: "Соберите свой выезд", description: "Три шага — и у вас предварительная цена. Итог считается сразу, а мы перезвоним, чтобы всё уточнить.", action: null },
}

export type HomepageSectionKey = CmsHomeSectionKey | "why-us" | "partners"
export const DEFAULT_HOMEPAGE_SECTION_ORDER: HomepageSectionKey[] = ["events", "houses", "sauna-chan", "programs", "venues", "blog", "why-us", "reviews", "map", "faq", "calculator", "partners"]

const brandColor = "#2B9E47"

export const DEFAULT_PUBLIC_NAVIGATION: SiteNavigationConfig = {
  brand: {
    title: "СВИСТОПЛЯСОВО",
    subtitle: "Глэмпинг & База отдыха",
    mark: "СВ",
    href: "/#hero",
    color: brandColor,
  },
  items: [
    {
      id: "houses",
      label: "Глэмпинг и дома",
      href: "/#houses",
      icon: "home",
      color: brandColor,
      description: "Уютный глэмпинг в соснах",
      children: [
        { id: "house-gnezdo", label: "Дом «Гнездо»", description: "A-frame коттедж с личным чаном на 2–4 чел", href: "/#houses" },
        { id: "house-tree", label: "«Дом на дереве»", description: "Шале на сваях на высоте 3м с проектором", href: "/#houses" },
        { id: "house-features", label: "Условия и оснащение", description: "Кухня, сатин, теплый пол, мангал", href: "/#houses" },
      ],
    },
    {
      id: "sauna",
      label: "Баня и чан",
      href: "/#sauna",
      icon: "flame",
      color: "#EE2F2E",
      description: "СПА-комплекс на живом огне",
      children: [
        { id: "sauna-main", label: "Кедровая русская баня", description: "Парная на дровах с купелью и самоваром", href: "/#sauna" },
        { id: "sauna-chan", label: "Сибирский чан с пихтой", description: "Горячая купель под открытым небом 38-42°C", href: "/#sauna" },
        { id: "sauna-spa", label: "СПА-девичники и парение", description: "Травяные сборы, мед, аромапарение", href: "/#sauna" },
      ],
    },
    {
      id: "programs",
      label: "Программы праздников",
      href: "/#programs",
      icon: "sparkles",
      color: "#FAAB2B",
      description: "Event-команда «Зажигай»",
      children: [
        { id: "program-corporate", label: "Корпоративы и тимбилдинг", description: "Форт Боярд, квизы, кулинарные баттлы", href: "/#programs" },
        { id: "program-wedding", label: "Свадьбы на природе", description: "Выездная регистрация и шатёр в соснах", href: "/#programs" },
        { id: "program-graduation", label: "Выпускные и школьные", description: "Лазертаг, TikTok-квесты, шоу программы", href: "/#programs" },
        { id: "program-family", label: "Семейные дни рождения", description: "Душевные сценарии для всех поколений", href: "/#programs" },
      ],
    },
    {
      id: "venues",
      label: "Площадки и залы",
      href: "/#venues",
      icon: "layers",
      color: "#18191B",
      description: "Локации для любого формата",
      children: [
        { id: "venue-banquet", label: "Банкетный зал (до 150)", description: "Панорамный светлый зал с профессиональным звуком", href: "/#venues" },
        { id: "venue-veranda", label: "Панорамная веранда (до 60)", description: "Уютная крытая терраса с гирляндами", href: "/#venues" },
        { id: "venue-forest", label: "Лесная беседка & Тёплая юрта", description: "Мангал, печь-камин, уют для компании", href: "/#venues" },
      ],
    },
    {
      id: "events",
      label: "Ближайшие события",
      href: "/#events",
      icon: "calendar",
      color: brandColor,
      description: "Афиша мероприятий",
      children: [
        { id: "event-music", label: "Музыкальные вечера", description: "Живой звук и чай у костра на закате", href: "/#events" },
        { id: "event-family", label: "Семейные квесты", description: "Приключения по лесным тропам с подарками", href: "/#events" },
        { id: "event-vk", label: "Сообщество ВКонтакте", description: "Горящие даты, скидки и фотоотчеты", href: "https://vk.com/svistoplyasovo", external: true },
      ],
    },
    {
      id: "map",
      label: "Карта базы (12 га)",
      href: "/#map",
      icon: "compass",
      color: "#18191B",
      description: "Территория «Свистоплясово»",
      children: [
        { id: "map-base", label: "Интерактивная карта", description: "Расположение домиков, бани и локаций", href: "/#map" },
        { id: "map-rest", label: "Костровище и качели", description: "Зоны отдыха, лесные тропы и река", href: "/#map" },
      ],
    },
    {
      id: "location",
      label: "Как добраться и FAQ",
      href: "/#location",
      icon: "map-pin",
      color: "#18191B",
      description: "30 минут от Кирова",
      children: [
        { id: "location-route", label: "Маршрут и навигатор", description: "Яндекс.Карты, 2ГИС, трансфер", href: "/#location" },
        { id: "location-faq", label: "Частые вопросы (FAQ)", description: "Дети, питомцы, заезд, чан, питание", href: "/#location" },
        { id: "location-calc", label: "Калькулятор отдыха", description: "Рассчитать стоимость за 1 минуту", href: "/#quiz" },
      ],
    },
  ],
  mobileItems: [],
}

export const DEFAULT_HERO_CONFIG: SiteHeroConfig = {
  enabled: true,
  badge: "30 минут от Кирова",
  title: "Глэмпинг в Кирове — дома с чаном и баней",
  slides: [
    { id: "glamping", image: RESORT_IMAGES.heroGlamping, imageAlt: "Глэмпинг в сосновом бору", title: "Глэмпинг в Кирове — дома с чаном и баней", tagline: "Тишина соснового бора, панорамные окна и горячая купель под открытым небом" },
    { id: "chan", image: RESORT_IMAGES.heroSunset, imageAlt: "Сибирский чан среди сосен", title: "Отдых с сибирским чаном среди сосен", tagline: "Парение на березовых дровах с пихтовыми ветками и цитрусами" },
    { id: "events", image: RESORT_IMAGES.heroNight, imageAlt: "Праздник на природе", title: "Праздники и свадьбы на природе", tagline: "Светлый банкетный зал, сцена, панорамная веранда и команда «Зажигай»" },
  ],
  primaryCta: { label: "Забронировать", action: "booking" },
  secondaryCta: { label: "Мероприятия", action: "navigate", target: "programs" },
  featureCards: [
    { id: "choose-house", title: "Выбрать домик", description: "С баней и чаном", image: RESORT_IMAGES.houseGnezdo1, imageAlt: "Выбрать домик", href: "/#houses", accent: "brand" },
    { id: "plan-event", title: "Провести мероприятие", description: "Площадки и праздники", image: RESORT_IMAGES.venueBanquet, imageAlt: "Провести мероприятие", href: "/#programs", accent: "neutral" },
  ],
  overlay: { from: 85, via: 45, to: 30 },
  autoplayMs: 6000,
}
