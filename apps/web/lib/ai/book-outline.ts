// Server-side only. Превращает учебник в компактную выжимку структуры для
// модели.
//
// ЗАЧЕМ ЭТО ВООБЩЕ НУЖНО. Учебник — это не файл учебного плана на три
// страницы. В библиотеке школы лежат PDF по 6, 9 и 31 мегабайту; после
// извлечения это сотни тысяч символов. Отправить такое в модель нельзя: не
// влезет в окно, а если бы влезло — стоило бы дорого и без всякой пользы,
// потому что для составления плана нужен СКЕЛЕТ книги, а не её содержание.
//
// КАК РЕШЕНО: НЕ РЕЖЕМ КНИГУ НА КУСКИ, А БЕРЁМ ЕЁ ОГЛАВЛЕНИЕ.
// Разбор по частям (прочитать всю книгу кусками и свести) обошёлся бы в
// десятки обращений к модели на одну книгу и дал бы худший результат: главы
// повторялись бы, нумерация ехала. Структура же учебника лежит на поверхности
// и почти вся — в начале:
//   1) первые страницы, где напечатано оглавление;
//   2) заголовки глав и разделов, разбросанные по всему тексту.
// Мы берём и то и другое: начало текста целиком и выловленные из ОСТАЛЬНОЙ
// книги строки, похожие на заголовки. Получается компактная выжимка
// постоянного размера — модель видит скелет книги любой толщины за одно
// обращение.
//
// ЧЕГО ЭТОТ ПОДХОД НЕ УМЕЕТ. Если у книги нет ни оглавления, ни узнаваемых
// заголовков (скан без текстового слоя, сплошной поток), выжимка получится
// бедной, и модель об этом скажет честно — темы будут крупными. Отдельный
// разбор таких книг постранично — это другая задача и другие деньги.

/** Сколько символов начала книги отдаём как есть. Примерно 15–25 страниц —
 *  титул, предисловие и оглавление помещаются с запасом. */
const HEAD_CHARS = 40_000;

/** Потолок на выловленные заголовки. Больше сотни строк оглавления не бывает
 *  даже у толстого учебника, а защита от мусора нужна: у книги без структуры
 *  «похожими на заголовок» окажутся сотни обрывков. */
const MAX_HEADINGS = 140;

/** Общий потолок выжимки. Держит стоимость обращения предсказуемой
 *  независимо от того, пришёл учебник на 50 страниц или на 800. */
const MAX_TOTAL_CHARS = 60_000;

/**
 * Строки, похожие на заголовок главы или раздела.
 *
 * Ловим то, что печатают в учебниках: «Глава 3», «Раздел II», «Тема 5»,
 * «§ 12», «Chapter 4», «Unit 2», «Lesson 7», а также нумерацию вида «3.2».
 * Требование к длине отсекает и обрывки («Глава»), и абзацы, случайно
 * начавшиеся со слова «Тема».
 */
const HEADING_RE = new RegExp(
  String.raw`(?:^|\s)((?:глава|раздел|тема|часть|урок|занятие|модуль|параграф|chapter|unit|lesson|section|part|module)\s*[№#]?\s*[0-9IVXЛ]{1,4}[.):]?\s+[^.!?\n]{4,90})`,
  "gi",
);
const NUMBERED_RE = /(?:^|\s)((?:\d{1,2}\.){1,2}\d{0,2}\s+[А-ЯA-ZЁ][^.!?\n]{6,90})/g;
const PARAGRAPH_RE = /(?:^|\s)(§\s*\d{1,3}[.)]?\s+[^.!?\n]{4,90})/g;

function collectHeadings(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const re of [HEADING_RE, NUMBERED_RE, PARAGRAPH_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const line = m[1]!.replace(/\s+/g, " ").trim();
      const key = line.toLowerCase();
      if (line.length < 8 || seen.has(key)) continue;
      seen.add(key);
      out.push(line);
      if (out.length >= MAX_HEADINGS) return out;
    }
  }
  return out;
}

export type BookOutline = {
  /** Готовая выжимка для промпта. */
  text: string;
  /** Символов в исходном тексте книги — для отчёта и для оценки стоимости. */
  sourceChars: number;
  /** Сколько заголовков удалось выловить за пределами начала. */
  headingCount: number;
  /** Книга не поместилась целиком и была сведена к скелету. */
  condensed: boolean;
};

/**
 * Собирает выжимку. `fullText` — весь извлечённый текст книги без обрезки.
 */
export function buildBookOutline(fullText: string): BookOutline {
  const text = fullText.replace(/\s+/g, " ").trim();
  const sourceChars = text.length;

  // Книга небольшая — отдаём как есть, никакой выжимки не нужно.
  if (sourceChars <= MAX_TOTAL_CHARS) {
    return { text, sourceChars, headingCount: 0, condensed: false };
  }

  const head = text.slice(0, HEAD_CHARS);
  const tail = text.slice(HEAD_CHARS);
  const headings = collectHeadings(tail);

  const parts = [
    `НАЧАЛО КНИГИ (титул, предисловие, оглавление):`,
    head,
  ];
  if (headings.length > 0) {
    parts.push(
      ``,
      `ЗАГОЛОВКИ, НАЙДЕННЫЕ ДАЛЬШЕ ПО КНИГЕ (${headings.length}):`,
      headings.join("\n"),
    );
  }

  let assembled = parts.join("\n");
  if (assembled.length > MAX_TOTAL_CHARS) assembled = assembled.slice(0, MAX_TOTAL_CHARS);

  return { text: assembled, sourceChars, headingCount: headings.length, condensed: true };
}

/** Примерная стоимость одного разбора в долларах. Токен ≈ 4 символа —
 *  та же грубая прикидка, что принята в отрасли; выход у нас невелик (список
 *  тем), поэтому считаем его отдельно и щедро. */
export function estimateOutlineCostUsd(outline: BookOutline, pricePerMillionIn: number, pricePerMillionOut: number): number {
  const inputTokens = outline.text.length / 4;
  const outputTokens = 2500; // список из 20–40 тем с описаниями — с запасом
  return (inputTokens / 1_000_000) * pricePerMillionIn + (outputTokens / 1_000_000) * pricePerMillionOut;
}
