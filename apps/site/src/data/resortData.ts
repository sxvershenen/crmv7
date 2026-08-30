export interface HouseItem {
  id: string;
  title: string;
  undertitle: string;
  description: string;
  detailedDescription: string;
  capacity: string;
  capacityNumber: number;
  priceFrom: number;
  photos: string[];
  perks: { icon: string; text: string }[];
  availability: { day: string; available: boolean }[];
  specs: { label: string; value: string }[];
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  dateBadge: string;
  dayMonth: string;
  time: string;
  photo: string;
  category: string;
  seatsLeft: number;
}

export interface ProgramItem {
  id: string;
  title: string;
  description: string;
  photo: string;
  category: 'corporate' | 'wedding' | 'school' | 'family';
  categoryLabel: string;
  age: string;
  season: string;
  duration: string;
  participants: string;
}

export interface VenueItem {
  id: string;
  title: string;
  capacity: string;
  capacityNumber: number;
  shortDesc: string;
  photo: string;
  suitableFor: string[];
  area: string;
  features: string[];
}

export interface ReviewItem {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  avatar: string;
  houseOrEvent: string;
}

export interface MapSpot {
  id: string;
  title: string;
  category: string;
  x: number; // percentage on map
  y: number; // percentage on map
  photo: string;
  description: string;
  features: string[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// High-resolution curated photos
export const RESORT_IMAGES = {
  heroGlamping: "https://images.pexels.com/photos/9211816/pexels-photo-9211816.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1400",
  heroForest: "https://images.pexels.com/photos/34923437/pexels-photo-34923437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1400",
  heroSunset: "https://images.pexels.com/photos/6932187/pexels-photo-6932187.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1400",
  heroNight: "https://images.pexels.com/photos/14776790/pexels-photo-14776790.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1400",

  // Houses
  houseGnezdo1: "https://images.pexels.com/photos/9211816/pexels-photo-9211816.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  houseGnezdo2: "https://images.pexels.com/photos/38495291/pexels-photo-38495291.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  houseGnezdo3: "https://images.pexels.com/photos/17396043/pexels-photo-17396043.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",

  houseTree1: "https://images.pexels.com/photos/9222075/pexels-photo-9222075.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  houseTree2: "https://images.pexels.com/photos/6932187/pexels-photo-6932187.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  houseTree3: "https://images.pexels.com/photos/7663226/pexels-photo-7663226.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",

  // Sauna & Chan
  sauna1: "https://images.pexels.com/photos/7598370/pexels-photo-7598370.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  sauna2: "https://images.pexels.com/photos/11319254/pexels-photo-11319254.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  sauna3: "https://images.pexels.com/photos/7598370/pexels-photo-7598370.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",

  chan1: "https://images.pexels.com/photos/29787702/pexels-photo-29787702.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  chan2: "https://images.pexels.com/photos/14436987/pexels-photo-14436987.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",
  chan3: "https://images.pexels.com/photos/9290991/pexels-photo-9290991.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=900",

  // Events & Categories
  corporateCat: "https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
  weddingCat: "https://images.pexels.com/photos/37958066/pexels-photo-37958066.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
  schoolCat: "https://images.pexels.com/photos/8035160/pexels-photo-8035160.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
  familyCat: "https://images.pexels.com/photos/5036997/pexels-photo-5036997.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",

  // Venues
  venueBanquet: "https://images.pexels.com/photos/37958068/pexels-photo-37958068.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
  venueVeranda: "https://images.pexels.com/photos/4993964/pexels-photo-4993964.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
  venueGazebo: "https://images.pexels.com/photos/7163636/pexels-photo-7163636.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
  venueYurt: "https://images.pexels.com/photos/10969912/pexels-photo-10969912.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",
  venueStage: "https://images.pexels.com/photos/28937190/pexels-photo-28937190.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",

  // Team & Proof
  teamPhoto: "https://images.pexels.com/photos/7551760/pexels-photo-7551760.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=700&w=1000",
  teamMarshmallow: "https://images.pexels.com/photos/5036960/pexels-photo-5036960.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=800",

  // Map Background
  mapBg: "https://images.pexels.com/photos/34923437/pexels-photo-34923437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=900&w=1600"
};

export const HOUSES: HouseItem[] = [
  {
    id: "gnezdo",
    title: "Дом «Гнездо»",
    undertitle: "Панорамный A-frame домик с личным сибирским чаном на террасе",
    description: "Уютный двухэтажный треугольный коттедж в глубине соснового бора. Панорамное остекление, тёплый пол, дизайнерский интерьер и горячий чан под звёздами прямо на террасе.",
    detailedDescription: "«Гнездо» создано для тех, кто ищет максимального единения с природой и домашнего тепла. На первом этаже расположена кухня-гостиная с панорамными окнами в пол, раскладным диваном и биокамином. На втором уровне — ортопедическая двуспальная кровать под треугольным сводом крыши. На просторной террасе вас ждёт собственный сибирский чан на дровах, заваренный на еловых лапах и сибирских травах.",
    capacity: "до 4",
    capacityNumber: 4,
    priceFrom: 6500,
    photos: [
      RESORT_IMAGES.houseGnezdo1,
      RESORT_IMAGES.houseGnezdo2,
      RESORT_IMAGES.houseGnezdo3
    ],
    perks: [
      { icon: "🔥", text: "Личный чан" },
      { icon: "🌲", text: "Вид на сосны" },
      { icon: "🍳", text: "Завтраки" },
      { icon: "📶", text: "Wi-Fi 100 Мбит" }
    ],
    availability: [
      { day: "ПН", available: true },
      { day: "ВТ", available: true },
      { day: "СР", available: false },
      { day: "ЧТ", available: true },
      { day: "ПТ", available: false }
    ],
    specs: [
      { label: "Площадь дома", value: "48 м² + терраса 24 м²" },
      { label: "Спальные места", value: "2+2 (кровать King Size + диван)" },
      { label: "Оснащение кухни", value: "Холодильник, плита, капсульный кофе, посуда" },
      { label: "Санузел", value: "Душ, тёплый пол, халаты, полотенца, фен" },
      { label: "Мангальная зона", value: "Индивидуальный гриль и костровище" }
    ]
  },
  {
    id: "treehouse",
    title: "«Дом на дереве»",
    undertitle: "Воздушный деревянный шале на сваях с мостиком и гамаком над кронами",
    description: "Уникальный домик, поднятый на 3 метра над землей среди вековых сосен. Смотровая площадка, стеклянная крыша над кроватью для наблюдения за звёздами и невероятная тишина.",
    detailedDescription: "«Дом на дереве» — это детская мечта, воплощённая в премиальном комфорте. Деревянная винтовая лестница ведёт на просторную террасу с подвесными качелями. Внутри вас ждёт тёплый экологичный интерьер из натурального дерева, проектор для вечерних кинопросмотров и окна в кроны деревьев.",
    capacity: "до 3",
    capacityNumber: 3,
    priceFrom: 7900,
    photos: [
      RESORT_IMAGES.houseTree1,
      RESORT_IMAGES.houseTree2,
      RESORT_IMAGES.houseTree3
    ],
    perks: [
      { icon: "🌲", text: "На высоте 3м" },
      { icon: "📽️", text: "Проектор" },
      { icon: "☕", text: "Кофемашина" },
      { icon: "🔥", text: "Мангал" }
    ],
    availability: [
      { day: "ПН", available: false },
      { day: "ВТ", available: true },
      { day: "СР", available: true },
      { day: "ЧТ", available: true },
      { day: "ПТ", available: true }
    ],
    specs: [
      { label: "Площадь дома", value: "36 м² + балкон-палуба" },
      { label: "Спальные места", value: "2+1 (панорамная кровать + кресло-кровать)" },
      { label: "Оснащение", value: "Проектор с подпиской Кинопоиск, чайная станция" },
      { label: "Санузел", value: "Душевая кабина с тропическим душем, косметика" },
      { label: "Мангальная зона", value: "У подножия с подсветкой и решетками" }
    ]
  }
];

export const EVENTS: EventItem[] = [
  {
    id: "ev-1",
    title: "Вечер живой музыки и чайная церемония у костра",
    description: "Акустический вечер на закате, авторские травяные сборы из кировских трав, маршмеллоу на костре и душевные разговоры.",
    dateBadge: "15 Марта",
    dayMonth: "15 Марта",
    time: "18:00 – 21:30",
    photo: "https://images.pexels.com/photos/7438427/pexels-photo-7438427.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
    category: "Атмосферный вечер",
    seatsLeft: 6
  },
  {
    id: "ev-2",
    title: "Семейный лесной квест «Тайны Свистоплясово»",
    description: "Большое приключение для детей и родителей по лесной тропе с поиском артефактов, аниматорами команды «Зажигай» и призами.",
    dateBadge: "22 Марта",
    dayMonth: "22 Марта",
    time: "12:00 – 15:00",
    photo: "https://images.pexels.com/photos/8035160/pexels-photo-8035160.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
    category: "Семейная программа",
    seatsLeft: 8
  },
  {
    id: "ev-3",
    title: "Большой банный СПА-девичник с парением в чане",
    description: "Аромапарение с пихтовыми вениками, скрабирование с медом и солью, горячий чан с грейпфрутом и розмарином, ягодный морс.",
    dateBadge: "29 Марта",
    dayMonth: "29 Марта",
    time: "14:00 – 18:00",
    photo: "https://images.pexels.com/photos/29787702/pexels-photo-29787702.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=600",
    category: "СПА и Релакс",
    seatsLeft: 4
  }
];

export const SAUNA_CHAN_DATA = {
  sauna: {
    id: "sauna",
    title: "Кедровая русская баня на березовых дровах",
    description: "Настоящая парная из сибирского кедра с мягким влажным паром, целебными вениками и зоной отдыха с самоваром и травяными чаями.",
    priceFrom: "2 500 ₽/час",
    photos: [RESORT_IMAGES.sauna1, RESORT_IMAGES.sauna2, RESORT_IMAGES.sauna3],
    tabs: [
      {
        id: "perks",
        label: "Преимущества",
        content: "Печь-каменка с полутонной жадеита, аромат натурального кедра, купель с родниковой водой на выходе, просторная комната отдыха на 10 гостей."
      },
      {
        id: "process",
        label: "Как проходит",
        content: "К вашему приходу парная уже прогрета до 80-90°C. Предоставляем дубовые и березовые веники, войлочные шапочки, простыни, чай на кировских травах и сушки."
      },
      {
        id: "safety",
        label: "Безопасность",
        content: "Регулярная дезинфекция паром, приточная вентиляция «второе дыхание», противопожарная защита и аптечка первой помощи всегда наготове."
      }
    ]
  },
  chan: {
    id: "chan",
    title: "Сибирский горячий банный чан с пихтой и цитрусами",
    description: "Купель из пищевой нержавеющей стали с отделкой из лиственницы, установленная прямо под открытым небом над живым огнём.",
    priceFrom: "4 500 ₽/топка (3 часа)",
    photos: [RESORT_IMAGES.chan1, RESORT_IMAGES.chan2, RESORT_IMAGES.chan3],
    tabs: [
      {
        id: "perks",
        label: "Преимущества",
        content: "Вода нагревается до комфортных 38–42°C. В воду добавляются свежие пихтовые лапы, дольки апельсинов и грейпфрутов, эфирные масла мяты и эвкалипта."
      },
      {
        id: "process",
        label: "Как проходит",
        content: "Топка занимает 2.5 часа. Вы погружаетесь в парящую воду на свежем морозном воздухе, любуетесь верхушками сосен и звездным небом."
      },
      {
        id: "safety",
        label: "Безопасность",
        content: "Дно и сиденья защищены натуральной лиственницей от ожогов, температура контролируется термометром, безопасная удобная лестница с поручнями."
      }
    ]
  }
};

export const PROGRAM_CATEGORIES = [
  {
    id: "corporate",
    title: "Корпоративы и тимбилдинги",
    countText: "14 программ",
    photo: RESORT_IMAGES.corporateCat
  },
  {
    id: "wedding",
    title: "Свадьбы на природе",
    countText: "8 локаций и пакетов",
    photo: RESORT_IMAGES.weddingCat
  },
  {
    id: "school",
    title: "Выпускные и школьные",
    countText: "22 авторских квеста",
    photo: RESORT_IMAGES.schoolCat
  },
  {
    id: "family",
    title: "Семейные праздники",
    countText: "16 душевных программ",
    photo: RESORT_IMAGES.familyCat
  }
];

export const POPULAR_PROGRAMS: ProgramItem[] = [
  {
    id: "prog-1",
    title: "Лесной Форт Боярд: Испытание стихиями",
    description: "Динамичный тимбилдинг с масштабным реквизитом, веревочными переправами, головоломками от старца Фура и командными испытаниями.",
    photo: "https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "corporate",
    categoryLabel: "Корпоратив",
    age: "14+ лет",
    season: "Круглый год",
    duration: "2.5 – 3 часа",
    participants: "от 10 до 120 чел"
  },
  {
    id: "prog-2",
    title: "Школьный выпускной «Поколение Z: Хроники леса»",
    description: "Современный интерактивный праздник: лазертаг-баттл, TikTok-станции, зажигательный ведущий, крио-шоу и дискотека с конфетти.",
    photo: "https://images.pexels.com/photos/8035160/pexels-photo-8035160.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "school",
    categoryLabel: "Выпускной",
    age: "7 – 17 лет",
    season: "Весна / Лето",
    duration: "4 часа",
    participants: "от 15 до 80 детей"
  },
  {
    id: "prog-3",
    title: "Свадебный уикенд «Лесная сказка»",
    description: "Выездная регистрация в соснах, праздничный ужин в панорамном шатре, лаунж у костровища, проживание молодоженов в домике «Гнездо».",
    photo: "https://images.pexels.com/photos/37958066/pexels-photo-37958066.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "wedding",
    categoryLabel: "Свадьба",
    age: "Для всех",
    season: "Май — Октябрь",
    duration: "Полный день / 2 дня",
    participants: "от 20 до 150 гостей"
  },
  {
    id: "prog-4",
    title: "Семейный День Рождения «По следам сосновых духов»",
    description: "Уютный душевный сценарий с аниматорами, мастер-классом по выпечке пиццы на открытом огне, играми для бабушек, мам и малышей.",
    photo: "https://images.pexels.com/photos/5036997/pexels-photo-5036997.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "family",
    categoryLabel: "Семейный",
    age: "0 – 99 лет",
    season: "Круглый год",
    duration: "2 часа",
    participants: "от 6 до 35 чел"
  },
  {
    id: "prog-5",
    title: "Кулинарный баттл «Гриль-Мастер Свистоплясово»",
    description: "Соревнование команд под руководством шеф-повара: готовка авторских бургеров, стейков и глинтвейна в казане на живом огне.",
    photo: "https://images.pexels.com/photos/33419108/pexels-photo-33419108.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "corporate",
    categoryLabel: "Корпоратив",
    age: "18+ лет",
    season: "Круглый год",
    duration: "3 часа",
    participants: "от 12 до 60 чел"
  },
  {
    id: "prog-6",
    title: "Лесной лазертаг «Захват базы»",
    description: "Тактические бои на безопасном оборудовании 9-го поколения по специально оборудованному полигону среди деревьев и укрытий.",
    photo: "https://images.pexels.com/photos/17746214/pexels-photo-17746214.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=400",
    category: "school",
    categoryLabel: "Школьный",
    age: "8+ лет",
    season: "Круглый год",
    duration: "2 часа",
    participants: "от 10 до 40 чел"
  }
];

export const VENUES: VenueItem[] = [
  {
    id: "banquet-hall",
    title: "Банкетный зал",
    capacity: "до 150",
    capacityNumber: 150,
    shortDesc: "Светлый зал с панорамным остеклением, круглыми столами, сценой и профессиональным звуковым оборудованием.",
    photo: RESORT_IMAGES.venueBanquet,
    suitableFor: ["Свадьба", "Корпоратив", "Банкет"],
    area: "220 м²",
    features: ["Звук 4 кВт", "Световые головы", "Кондиционеры", "Гардероб"]
  },
  {
    id: "veranda",
    title: "Панорамная веранда",
    capacity: "до 60",
    capacityNumber: 60,
    shortDesc: "Крытая открытая терраса из дерева с видом на вековые ели, подвесными гирляндами и мягкими пледами.",
    photo: RESORT_IMAGES.venueVeranda,
    suitableFor: ["Юбилей", "День рождения", "Ужин"],
    area: "90 м²",
    features: ["Инфракрасный обогрев", "Барная стойка", "Музыкальная колонка"]
  },
  {
    id: "gazebo",
    title: "Лесная беседка",
    capacity: "до 25",
    capacityNumber: 25,
    shortDesc: "Уединенная деревянная беседка с собственной мангальной зоной, большим дубовым столом и розетками.",
    photo: RESORT_IMAGES.venueGazebo,
    suitableFor: ["Барбекю", "Пикник", "Встреча друзей"],
    area: "35 м²",
    features: ["Мангал и казан", "Освещение", "Электричество"]
  },
  {
    id: "yurt",
    title: "Тёплая юрта",
    capacity: "до 40",
    capacityNumber: 40,
    shortDesc: "Колоритное круглое пространство с печью-камином в центре, мягкими коврами, подушками и этнической атмосферой.",
    photo: RESORT_IMAGES.venueYurt,
    suitableFor: ["Ретрит", "Тематический вечер", "Квест"],
    area: "65 м²",
    features: ["Печь-камин", "Чайная зона", "Проектор"]
  },
  {
    id: "stage-amphi",
    title: "Амфитеатр и сцена",
    capacity: "до 300",
    capacityNumber: 300,
    shortDesc: "Открытая площадка в форме амфитеатра с деревянной сценой для масштабных фестивалей, концертов и шоу.",
    photo: RESORT_IMAGES.venueStage,
    suitableFor: ["Фестиваль", "Выпускной", "Шоу-программа"],
    area: "400 м²",
    features: ["Подключение 380В", "Зрительские ярусы", "Костровая чаша"]
  }
];

export const WHY_US_FACTS = [
  {
    id: "distance",
    number: "30 мин",
    title: "От центра Кирова",
    desc: "Идеальный асфальт до самых ворот базы. Удобно добираться на авто, такси или заказном автобусе. Собственная охраняемая парковка на 60 мест."
  },
  {
    id: "nature",
    number: "12 га",
    title: "Соснового бора",
    desc: "Закрытая охраняемая территория без посторонних. Хвойный воздух, берег живописной реки, лесные тропы для прогулок и тишина."
  },
  {
    id: "team",
    number: "12 чел",
    title: "Команда «Зажигай»",
    desc: "Собственный штат профессиональных ведущих, режиссёров и аниматоров. 80+ готовых сценариев праздников, никакого стороннего найма."
  },
  {
    id: "allinclusive",
    number: "100%",
    title: "Событие под ключ",
    desc: "Проживание в домиках, баня, чан, ресторанное обслуживание, сценарий и декор от одного ответственного организатора."
  }
];

export const REVIEWS_DATA: ReviewItem[] = [
  {
    id: "rev-1",
    name: "Екатерина и Дмитрий",
    date: "12 февраля 2025",
    rating: 5,
    text: "Отмечали годовщину в домике «Гнездо». Это просто космос! Чан на террасе с еловыми ветками на морозе — ни с чем не сравнимое блаженство. Домик чистейший, всё продумано до мелочей: от кофемашины до мягких тапочек. Персонал очень заботливый, как будто приехали к родной бабушке в гости!",
    avatar: "https://images.pexels.com/photos/7551763/pexels-photo-7551763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=120&w=120",
    houseOrEvent: "Глэмпинг «Гнездо»"
  },
  {
    id: "rev-2",
    name: "Алексей Смирнов, IT-директор",
    date: "28 января 2025",
    rating: 5,
    text: "Проводили зимний корпоратив на 45 человек. Команда «Зажигай» сделала невероятный квест по лесу, даже наши самые нелюдимые разработчики бегали с горящими глазами! После квеста отогревались в бане и чане, а вечером был банкет. Всё четко по таймингу, без накладок. Рекомендую 100%!",
    avatar: "https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=120&w=120",
    houseOrEvent: "Корпоратив компании"
  },
  {
    id: "rev-3",
    name: "Светлана Макарова",
    date: "18 января 2025",
    rating: 5,
    text: "Праздновали выпускной 4 класса. Дети в полнейшем восторге, родители отдохнули на веранде с чаем и шашлыком. Никакой суеты: аниматоры держали внимание детей все 3.5 часа. Локация очень красивая, безопасная, сосны величавые. Обязательно вернемся летом!",
    avatar: "https://images.pexels.com/photos/7551783/pexels-photo-7551783.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=120&w=120",
    houseOrEvent: "Выпускной 4 класс"
  }
];

export const VIDEO_REELS = [
  {
    id: "vid-1",
    title: "Зимний вечер в глэмпинге «Гнездо» и горячий чан",
    duration: "0:45",
    thumbnail: RESORT_IMAGES.heroSunset,
    embedUrl: "https://images.pexels.com/photos/29787702/pexels-photo-29787702.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=1000",
    tag: "Глэмпинг и Чан"
  },
  {
    id: "vid-2",
    title: "Атмосфера лесной свадьбы в банкетном зале",
    duration: "1:12",
    thumbnail: RESORT_IMAGES.venueBanquet,
    embedUrl: "https://images.pexels.com/photos/37958066/pexels-photo-37958066.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=1000",
    tag: "Свадьбы"
  },
  {
    id: "vid-3",
    title: "Корпоративный квест «Форт Боярд» в сосновом бору",
    duration: "0:58",
    thumbnail: RESORT_IMAGES.corporateCat,
    embedUrl: "https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=1000",
    tag: "Тимбилдинг"
  },
  {
    id: "vid-4",
    title: "Парение в кедровой бане и отдых у камина",
    duration: "0:36",
    thumbnail: RESORT_IMAGES.sauna1,
    embedUrl: "https://images.pexels.com/photos/7598370/pexels-photo-7598370.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=600&w=1000",
    tag: "СПА & Баня"
  }
];

export const MAP_SPOTS: MapSpot[] = [
  {
    id: "spot-gnezdo",
    title: "Дом «Гнездо» с чаном",
    category: "Глэмпинг",
    x: 28,
    y: 35,
    photo: RESORT_IMAGES.houseGnezdo1,
    description: "Треугольный коттедж A-frame с собственной террасой и чаном под открытым небом.",
    features: ["до 4 человек", "Чан на террасе", "Мангал"]
  },
  {
    id: "spot-treehouse",
    title: "«Дом на дереве»",
    category: "Глэмпинг",
    x: 42,
    y: 25,
    photo: RESORT_IMAGES.houseTree1,
    description: "Панорамный дом на высоте 3 метров среди ветвей вековых сосен.",
    features: ["до 3 человек", "Проектор", "Вид на реку"]
  },
  {
    id: "spot-sauna",
    title: "Кедровая баня и Чан",
    category: "СПА комплекс",
    x: 22,
    y: 58,
    photo: RESORT_IMAGES.sauna1,
    description: "Парная на дровах из кедра, купель с родниковой водой и горячий чан с пихтой.",
    features: ["до 10 человек", "Березовые дрова", "Самовар"]
  },
  {
    id: "spot-banquet",
    title: "Банкетный зал",
    category: "Площадка",
    x: 65,
    y: 45,
    photo: RESORT_IMAGES.venueBanquet,
    description: "Светлое панорамное пространство для свадеб и корпоративных праздников.",
    features: ["до 150 гостей", "Звуковое оборудование", "Сцена"]
  },
  {
    id: "spot-veranda",
    title: "Панорамная веранда",
    category: "Площадка",
    x: 78,
    y: 32,
    photo: RESORT_IMAGES.venueVeranda,
    description: "Крытая терраса с гирляндами и видом на сосновый бор.",
    features: ["до 60 гостей", "Обогрев", "Барбекю"]
  },
  {
    id: "spot-yurt",
    title: "Тёплая юрта",
    category: "Площадка",
    x: 55,
    y: 70,
    photo: RESORT_IMAGES.venueYurt,
    description: "Уютное круглое пространство с дровяным камином и коврами.",
    features: ["до 40 гостей", "Камин", "Этно-стиль"]
  },
  {
    id: "spot-bonfire",
    title: "Костровая поляна",
    category: "Атмосфера",
    x: 45,
    y: 50,
    photo: "https://images.pexels.com/photos/5036997/pexels-photo-5036997.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=400&w=600",
    description: "Большой очаг со скамьями из бревен, теплые пледы и маршмеллоу под звездами.",
    features: ["Общая зона", "Гитары", "Живой огонь"]
  }
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-1",
    question: "Как забронировать домик или площадку?",
    answer: "Так как у нас индивидуальный подход к каждому гостю, мы не используем автоматическую безликую систему бронирования. Нажмите кнопку «Забронировать» — вы сможете написать нам в сообщения ВКонтакте или позвонить менеджеру. Мы уточним все ваши пожелания, закрепим удобные даты и подготовим домик.",
    category: "booking"
  },
  {
    id: "faq-2",
    question: "Что входит в стоимость проживания в домике?",
    answer: "В стоимость входит проживание выбранного числа гостей, постельное белье премиум-класса, мягкие полотенца и халаты, гигиенические наборы, полностью оборудованная кухня (посуда, чай, капсульный кофе), индивидуальная мангальная зона с решетками, Wi-Fi и парковка.",
    category: "glamping"
  },
  {
    id: "faq-3",
    question: "Как топится и готовится сибирский чан?",
    answer: "Мы подготавливаем и растапливаем чан строго к назначенному вами времени на березовых дровах (топка занимает около 2.5–3 часов). В воду добавляются свежие ветки пихты и дольки цитрусовых. Температура поддерживается на уровне 38–42°C на протяжении 3 часов парения.",
    category: "chan"
  },
  {
    id: "faq-4",
    question: "Можно ли приезжать с детьми и какие условия?",
    answer: "Мы очень рады семьям с детьми любого возраста! Дети до 6 лет без предоставления отдельного спального места проживают бесплатно. На территории есть безопасная детская площадка, квесты от команды «Зажигай», настольные игры и возможность заказать детское меню.",
    category: "kids"
  },
  {
    id: "faq-5",
    question: "Разрешено ли проживание с домашними питомцами (Dog-friendly)?",
    answer: "Да, мы dog-friendly! Вы можете приехать с собаками мелких и средних пород по предварительному согласованию. Доплата за питомца составляет 1 000 ₽ за весь период проживания для проведения специальной гипоаллергенной уборки.",
    category: "pets"
  },
  {
    id: "faq-6",
    question: "Во сколько заезд и выезд?",
    answer: "Стандартное время заезда в домики — с 15:00, время выезда — до 12:00. При наличии возможности мы с радостью предоставим ранний заезд или поздний выезд без дополнительной платы (согласуется с администратором накануне).",
    category: "checkin"
  },
  {
    id: "faq-7",
    question: "Как организовано питание на базе?",
    answer: "В каждом домике есть кухня для самостоятельного приготовления и индивидуальный мангал. Также вы можете заказать завтраки в домик, фермерские сырные и мясные наборы для гриля, а для мероприятий мы предоставляем ресторанный кейтеринг и банкетное меню от шеф-повара.",
    category: "food"
  },
  {
    id: "faq-8",
    question: "Как проходит организация корпоративов и свадеб «под ключ»?",
    answer: "Вы просто озвучиваете нам повод, дату и число гостей. Наша команда «Зажигай» берет на себя всё: подбор площадки, составление авторского сценария, работу ведущего и диджея, декор, банкет, фотографа и трансфер из Кирова.",
    category: "events"
  },
  {
    id: "faq-9",
    question: "Есть ли трансфер и какая дорога до базы?",
    answer: "До базы отдыха «Свистоплясово» проложен асфальтированный подъезд, который регулярно чистится зимой. Дорога от центра Кирова занимает ровно 30 минут. По запросу мы организуем комфортный трансфер на легковых авто или микроавтобусах Mercedes Sprinter.",
    category: "location"
  },
  {
    id: "faq-10",
    question: "Какие правила отмены бронирования?",
    answer: "При отмене более чем за 7 дней до даты заезда предоплата возвращается в полном объеме либо переносится на любые другие свободные даты по вашему выбору.",
    category: "booking"
  }
];

export const PARTNERS_LIST = [
  "Вятка Банк",
  "Кировский ССК",
  "Додо Пицца Киров",
  "Движение Нефтепродукт",
  "СТКС Холдинг",
  "Фармацевтика Вятки",
  "IT-Кластер Киров",
  "Альфа-Банк",
  "Сеть оптик «Взгляд»",
  "ГК «Железно»"
];

export const PROMO_CODES = [
  {
    id: "glamp",
    code: "GLAMP3000",
    amount: "3 000 ₽",
    title: "На первое заселение",
    desc: "Промокод на месяц 3 000 ₽ на первое заселение в глэмпинг",
    emoji: "🌲",
    colorBg: "#2B9E47",
    tag: "Глэмпинг"
  },
  {
    id: "kids",
    code: "DETI1000",
    amount: "1 000 ₽",
    title: "Детские программы",
    desc: "Промокод на месяц 1 000 ₽ на детские программы и квесты",
    emoji: "🎈",
    colorBg: "#FAAB2B",
    tag: "Праздники"
  },
  {
    id: "bday",
    code: "BIRTHDAY20",
    amount: "-20%",
    title: "В день рождения",
    desc: "Скидка 20% в день рождения на все домики и баню",
    emoji: "🎂",
    colorBg: "#EE2F2E",
    tag: "Именинникам"
  }
];
