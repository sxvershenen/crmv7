import { RESORT_IMAGES } from './resortData';

export interface BlogArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  photo?: string;
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'house-weekend',
    title: 'Как выбрать домик для загородного уикенда',
    description: 'Чек-лист по вместимости, удобствам и сценариям отдыха без лишней суеты.',
    category: 'Домики',
    photo: RESORT_IMAGES.houseGnezdo1,
  },
  {
    id: 'sauna-rules',
    title: 'Баня и чан: как подготовиться к отдыху',
    description: 'Что взять с собой, как спланировать время и сделать парение комфортным.',
    category: 'Баня и чан',
    photo: RESORT_IMAGES.chan1,
  },
  {
    id: 'forest-celebration',
    title: 'Праздник на природе: с чего начать',
    description: 'Простой план: формат, гости, площадка, программа и детали, которые важно учесть.',
    category: 'Праздники',
    photo: RESORT_IMAGES.teamMarshmallow,
  },
  {
    id: 'venue-guide',
    title: 'Какая площадка подойдёт вашей компании',
    description: 'Сравниваем камерные и большие форматы по вместимости, атмосфере и задачам.',
    category: 'Площадки',
    photo: RESORT_IMAGES.venueVeranda,
  },
  {
    id: 'family-packing',
    title: 'Что взять на базу отдыха с детьми',
    description: 'Короткий список вещей для прогулок, сна, игр и переменчивой погоды.',
    category: 'Семейный отдых',
  },
  {
    id: 'weekend-plan',
    title: 'Сценарий выходных на природе',
    description: 'Как собрать в один маршрут прогулку, чан, ужин и спокойное утро.',
    category: 'Идеи',
  },
  {
    id: 'corporate-format',
    title: 'Форматы корпоратива за городом',
    description: 'Как выбрать между командной игрой, спокойным ужином и полноценным выездом.',
    category: 'Команда',
  },
  {
    id: 'weather-plan',
    title: 'План на случай дождя',
    description: 'Как сохранить атмосферу загородного события, если погода изменилась.',
    category: 'Планирование',
  },
  {
    id: 'quiet-rest',
    title: 'Как устроить по-настоящему тихий отдых',
    description: 'Идеи для выходных без спешки: лес, тёплый дом, чай, огонь и минимум расписания.',
    category: 'Отдых',
  },
  {
    id: 'event-timing',
    title: 'Тайминг загородного праздника',
    description: 'Как распределить встречу гостей, активности, ужин и отдых без перегруза.',
    category: 'Праздники',
  },
];

export const FEATURED_BLOG_ARTICLES = BLOG_ARTICLES.slice(0, 4);
export const MORE_BLOG_ARTICLES = BLOG_ARTICLES.slice(4);
