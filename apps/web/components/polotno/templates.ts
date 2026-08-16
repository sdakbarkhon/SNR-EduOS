/**
 * Наши стартовые заготовки для редактора.
 *
 * ЗАЧЕМ СВОИ, ЕСЛИ У POLOTNO ЕСТЬ ГАЛЕРЕЯ. Их галерея шаблонов приходит с их
 * сервера и рассчитана на маркетинг: посты, сторис, реклама. Школе нужны свои
 * поводы — плакат к уроку и стенгазета. Формат заготовки — обычный JSON сцены,
 * тот же, что отдаёт `store.toJSON()`, поэтому новую заготовку можно сделать
 * прямо в редакторе: собрать, сохранить, скопировать JSON сюда.
 *
 * Проверка «можно ли положить свой шаблон стартовой заготовкой» — один из
 * вопросов этой пробы; здесь ответ и лежит.
 */

type Scene = Record<string, unknown>;

/** Текстовый элемент со значениями, которые Polotno ждёт от сцены. */
function text(attrs: {
  id: string;
  x: number;
  y: number;
  width: number;
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  align?: string;
}): Scene {
  return {
    id: attrs.id,
    type: "text",
    x: attrs.x,
    y: attrs.y,
    width: attrs.width,
    height: attrs.fontSize * 1.4,
    rotation: 0,
    opacity: 1,
    visible: true,
    text: attrs.text,
    placeholder: "",
    fontSize: attrs.fontSize,
    fontFamily: attrs.fontFamily ?? "Roboto",
    fontStyle: "normal",
    fontWeight: attrs.fontWeight ?? "normal",
    textDecoration: "",
    fill: attrs.fill ?? "rgba(23,18,67,1)",
    align: attrs.align ?? "center",
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0,
    strokeWidth: 0,
    stroke: "black",
  };
}

function page(id: string, children: Scene[], background: string): Scene {
  return {
    id,
    children,
    width: "auto",
    height: "auto",
    background,
    bleed: 0,
    duration: 5000,
  };
}

function scene(width: number, height: number, pageId: string, children: Scene[], background: string): Scene {
  return {
    width,
    height,
    fonts: [],
    pages: [page(pageId, children, background)],
    audios: [],
    unit: "px",
    dpi: 72,
  };
}

export type PolotnoTemplate = { id: string; json: Scene };

export const POLOTNO_TEMPLATES: PolotnoTemplate[] = [
  {
    // Плакат к уроку — книжная страница, крупный заголовок и место под текст.
    id: "poster",
    json: scene(1080, 1350, "tpl-poster", [
      text({ id: "tpl-poster-title", x: 90, y: 160, width: 900, text: "Заголовок плаката", fontSize: 84, fontWeight: "bold" }),
      text({ id: "tpl-poster-sub", x: 90, y: 320, width: 900, text: "Подзаголовок — о чём работа", fontSize: 40, fill: "rgba(80,72,140,1)" }),
      text({ id: "tpl-poster-body", x: 90, y: 460, width: 900, text: "Здесь текст: что вы узнали, что важно запомнить.", fontSize: 32, align: "left", fill: "rgba(40,34,90,1)" }),
      text({ id: "tpl-poster-author", x: 90, y: 1210, width: 900, text: "Имя и класс", fontSize: 28, fill: "rgba(120,112,170,1)" }),
    ], "#F5F3FF"),
  },
  {
    // Стенгазета — альбомный лист под две колонки.
    id: "wallpaper",
    json: scene(1400, 900, "tpl-wall", [
      text({ id: "tpl-wall-title", x: 80, y: 70, width: 1240, text: "Название стенгазеты", fontSize: 72, fontWeight: "bold" }),
      text({ id: "tpl-wall-left", x: 80, y: 240, width: 580, text: "Первая колонка", fontSize: 30, align: "left", fill: "rgba(40,34,90,1)" }),
      text({ id: "tpl-wall-right", x: 740, y: 240, width: 580, text: "Вторая колонка", fontSize: 30, align: "left", fill: "rgba(40,34,90,1)" }),
      text({ id: "tpl-wall-date", x: 80, y: 790, width: 1240, text: "Класс и дата", fontSize: 26, fill: "rgba(120,112,170,1)" }),
    ], "#FFFFFF"),
  },
  {
    // Пустой лист — если заготовка не нужна.
    id: "blank",
    json: scene(1080, 1080, "tpl-blank", [], "#FFFFFF"),
  },
];
