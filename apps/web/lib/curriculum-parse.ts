import { generateJSON } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { buildCurriculumParsePrompt, buildBookToPlanPrompt } from "@/lib/ai/prompts";
import { CURRICULUM_TOPICS_SCHEMA } from "@/lib/ai/schemas";
import { extractText, mimeFromName } from "@/lib/file-extractors";
import { buildBookOutline } from "@/lib/ai/book-outline";

/**
 * РАЗБОР ИСТОЧНИКА В ТЕМЫ — ОДНО МЕСТО. 06.09.2026.
 *
 * ═══ ПОЧЕМУ ОН ЗДЕСЬ, А НЕ В МАРШРУТЕ ═════════════════════════════════════
 *
 * Эта цепочка — извлечь текст, собрать промпт, спросить модель, привести темы
 * к одной форме — жила ВНУТРИ `background-parse`, и её копия лежала в ручке
 * `/api/curriculum-plans/parse`, которую давно никто не звал. Теперь у неё
 * появляется третий вызывающий: заказ на файл (кнопка «Создать учебный
 * план»). Третьей копии не будет — цепочка переезжает сюда целиком, а мёртвая
 * ручка удаляется.
 *
 * ЧТО НЕ ПЕРЕЕХАЛО. Ни скачивание байтов, ни запись результата: у плана они
 * одни, у заказа другие. Здесь только то, что у них общее до буквы.
 */

export const MAX_TOPICS = 40;

export type ParsedTopic = {
  title: string;
  description: string | null;
  estimated_lessons: number;
};

export type РазборИсточника =
  | {
      вид: "книга";
      buffer: Buffer;
      /** Имя файла в хранилище — по нему определяется тип содержимого. */
      sourceName: string;
      bookTitle: string;
      subject: string;
      /** Класс: подпись группы, как её видит человек. */
      grade: string;
    }
  | {
      вид: "файл-плана";
      buffer: Buffer;
      sourceName: string;
    };

export type ШагРазбора = "extract" | "outline" | "model";

/**
 * Достаёт из источника упорядоченный список тем.
 *
 * `наШаге` вызывается перед каждым шагом — им маршрут двигает процент и пишет
 * стадию словами. Стадия настоящая, а не примета: учебник на тридцать
 * мегабайт читается ощутимо долго, и застывший процент человек принимает за
 * поломку.
 *
 * Бросает с ЧЕЛОВЕЧЕСКОЙ причиной: «не удалось извлечь текст», «модель не
 * ответила». Вызывающий кладёт её в отказ как есть — учитель должен видеть,
 * что именно случилось, а не «не вышло».
 */
export async function разобратьВТемы(
  источник: РазборИсточника,
  наШаге?: (шаг: ШагРазбора) => Promise<void> | void,
): Promise<ParsedTopic[]> {
  const книга = источник.вид === "книга";

  // ── Текст ────────────────────────────────────────────────────────────────
  await наШаге?.("extract");
  // Учебнику нужен ВЕСЬ текст: структура книги ищется по заголовкам во всей
  // толще, и обрезка на пятидесяти тысячах оставила бы первые двадцать
  // страниц. Сжатием до размера промпта занимается buildBookOutline.
  const extracted = await extractText(
    источник.buffer,
    mimeFromName(источник.sourceName),
    источник.sourceName,
    книга ? 4_000_000 : undefined,
  );
  const текст = extracted.text;
  if (!текст.trim()) {
    throw new Error(книга
      ? "Из книги не удалось извлечь текст — возможно, это скан без текстового слоя"
      : "Файл пуст или не удалось извлечь текст");
  }

  // ── Промпт ───────────────────────────────────────────────────────────────
  let prompt: string;
  if (источник.вид === "книга") {
    await наШаге?.("outline");
    const outline = buildBookOutline(текст);
    console.log(`[curriculum-parse] книга ${источник.bookTitle}: ${outline.sourceChars} символов`
      + (outline.condensed ? ` -> выжимка ${outline.text.length}, заголовков ${outline.headingCount}` : " — целиком"));
    prompt = buildBookToPlanPrompt({
      bookTitle: источник.bookTitle,
      subject: источник.subject || "—",
      grade: источник.grade || "—",
      outline: outline.text,
      condensed: outline.condensed,
      headingCount: outline.headingCount,
      maxTopics: MAX_TOPICS,
    });
  } else {
    prompt = buildCurriculumParsePrompt(текст, MAX_TOPICS);
  }

  // ── Модель ───────────────────────────────────────────────────────────────
  await наШаге?.("model");
  let topics: ParsedTopic[] | null = null;
  let последняяОшибка: string | null = null;
  for (let попытка = 0; попытка < 3 && !topics; попытка++) {
    const { data: parsed, error } = await generateJSON<Partial<ParsedTopic>[]>(prompt, CURRICULUM_TOPICS_SCHEMA, {
      model: "pro",
      usage: { task: книга ? AI_TASKS.bookToPlan : AI_TASKS.curriculumParse },
    });
    if (error || !Array.isArray(parsed) || parsed.length === 0) {
      последняяОшибка = error || "Не удалось разобрать ответ AI";
      continue;
    }
    topics = parsed.slice(0, MAX_TOPICS).map((t) => ({
      title: String(t.title ?? "").trim() || "Без названия",
      description: t.description ? String(t.description).trim() : null,
      estimated_lessons: Number.isFinite(t.estimated_lessons) && Number(t.estimated_lessons) > 0
        ? Math.round(Number(t.estimated_lessons))
        : 1,
    }));
  }
  if (!topics) throw new Error(последняяОшибка || "Не удалось распарсить план");
  return topics;
}
