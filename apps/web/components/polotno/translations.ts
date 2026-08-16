/**
 * Подписи самого редактора Polotno на русском и узбекском.
 *
 * Polotno переводится своим словарём: `setTranslations(obj)` из
 * 'polotno/config'. Ключи взяты из его же схемы (getTranslations в
 * polotno/utils/l10n) — здесь переведена та часть, которую ребёнок видит
 * постоянно: разделы левой панели, верхняя панель свойств и работа со
 * страницами. Непереведённые ключи остаются английскими, редактор от этого не
 * ломается — проверка `validate` намеренно не включается.
 *
 * Английский не задаётся вовсе: он у Polotno родной.
 */

type Pack = Record<string, unknown>;

const ru: Pack = {
  sidePanel: {
    templates: "Шаблоны",
    searchPlaceholder: "Поиск…",
    noResults: "Ничего не найдено",
    error: "Не удалось загрузить",
    text: "Текст",
    myFonts: "Мои шрифты",
    uploadFont: "Загрузить шрифт",
    elements: "Фигуры",
    shapes: "Фигуры",
    tables: "Таблицы",
    lines: "Линии",
    draw: "Рисование",
    upload: "Мои файлы",
    uploadImage: "Добавить файл",
    uploadTip: "Загрузите свои картинки",
    background: "Фон",
    resize: "Размер",
    layers: "Слои",
    noLayers: "На странице пока ничего нет",
    namePlaceholder: "Название элемента…",
    layersTip: "Элементы на этой странице:",
    layerTypes: {
      image: "Картинка",
      text: "Текст",
      svg: "Рисунок",
      line: "Линия",
      figure: "Фигура",
      group: "Группа",
    },
  },
  toolbar: {
    opacity: "Прозрачность",
    effects: "Эффекты",
    blur: "Размытие",
    saturation: "Насыщенность",
    contrast: "Контраст",
    shadows: "Тень",
    textBackground: "Фон текста",
    duration: "Длительность",
  },
  workspace: {
    noPages: "Страниц нет",
    addPage: "Добавить страницу",
    duplicatePage: "Дублировать страницу",
    removePage: "Удалить страницу",
    moveUp: "Выше",
    moveDown: "Ниже",
  },
};

const uz: Pack = {
  sidePanel: {
    templates: "Shablonlar",
    searchPlaceholder: "Qidiruv…",
    noResults: "Hech narsa topilmadi",
    error: "Yuklab bo‘lmadi",
    text: "Matn",
    myFonts: "Mening shriftlarim",
    uploadFont: "Shrift yuklash",
    elements: "Shakllar",
    shapes: "Shakllar",
    tables: "Jadvallar",
    lines: "Chiziqlar",
    draw: "Chizish",
    upload: "Mening fayllarim",
    uploadImage: "Fayl qo‘shish",
    uploadTip: "O‘z rasmlaringizni yuklang",
    background: "Fon",
    resize: "O‘lcham",
    layers: "Qatlamlar",
    noLayers: "Sahifada hozircha hech narsa yo‘q",
    namePlaceholder: "Element nomi…",
    layersTip: "Shu sahifadagi elementlar:",
    layerTypes: {
      image: "Rasm",
      text: "Matn",
      svg: "Chizma",
      line: "Chiziq",
      figure: "Shakl",
      group: "Guruh",
    },
  },
  toolbar: {
    opacity: "Shaffoflik",
    effects: "Effektlar",
    blur: "Xiralik",
    saturation: "To‘yinganlik",
    contrast: "Kontrast",
    shadows: "Soya",
    textBackground: "Matn foni",
    duration: "Davomiyligi",
  },
  workspace: {
    noPages: "Sahifalar yo‘q",
    addPage: "Sahifa qo‘shish",
    duplicatePage: "Sahifadan nusxa",
    removePage: "Sahifani o‘chirish",
    moveUp: "Yuqoriga",
    moveDown: "Pastga",
  },
};

export const POLOTNO_TRANSLATIONS: Partial<Record<"ru" | "uz" | "en", Pack>> = { ru, uz };
