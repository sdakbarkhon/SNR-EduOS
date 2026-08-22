// Server-side only — ходит к модели за вектором вопроса и в БД за кусками.
//
// ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. Поиск по материалам был написан ещё в Пачке 5.1,
// но с 17.08.2026 не исполнялся ни разу: функция buildRagContext лежала в
// app/actions/ai.ts, её единственный вызывающий (серверное действие
// callAiChat) был удалён вместе со вторым механизмом помощника, а сама она не
// экспортировалась — то есть весь ретривал был мёртвым кодом. Помощник при
// этом продолжал работать и собирал контекст напрямую из lesson_stages: тема,
// НАЗВАНИЯ этапов, НАЗВАНИЯ приложенных файлов. Текста материалов он не видел
// вообще, хотя промт обещал ему обратное — отсюда уверенные ответы «вообще по
// теме» вместо ответа по слайду.
//
// Переезд из "use server"-файла сюда — не косметика. Экспорт из файла с
// директивой "use server" превращает функцию в серверное ДЕЙСТВИЕ: Next
// заводит на неё точку входа, доступную по сети. Ретривал вызывать снаружи
// незачем, поэтому он живёт обычным модулем в lib/ и зовётся из маршрута
// напрямую.
//
// ГЛАВНОЕ ПРАВИЛО ЭТОГО ФАЙЛА: он не имеет права уронить ответ помощника и не
// имеет права его задержать. Ни одного throw наружу — любая беда даёт «ничего
// не нашлось». И жёсткий срок: сколько бы ни думала модель, ответ ученику
// уходит вовремя (см. RAG_DEADLINE_MS).

import { computeEmbedding } from "@/lib/ai/embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Сколько кусков реально уходит в промт. */
const RAG_TOP_K = 5;

/** Сколько просим у базы. Больше, чем уйдёт в промт: внутри урока мы хотим
 *  сначала выбрать куски ЭТОГО урока, а они могут не попасть в первую
 *  пятёрку, если по чистому совпадению их обошли куски прошлых уроков.
 *  Лишние строки бесплатны — обращение к модели одно, к базе одно.
 *
 *  ЧЕСТНАЯ ОГОВОРКА: это предпочтение, а не гарантия. Отбор по уроку идёт
 *  здесь, а обрезание — в самой функции базы (LIMIT по расстоянию). Если
 *  куски текущего урока не попали в эти двадцать, поднять их уже неоткуда.
 *  Гарантия потребовала бы параметра p_lesson_id в самой функции, то есть
 *  миграции. */
const RAG_FETCH_COUNT = 20;

/** Ниже этого совпадения кусок считается нерелевантным. Без порога помощник
 *  получал бы «лучшие пять» всегда, даже когда в уроках нет ничего близкого —
 *  то есть случайный шум с видом источника. */
const RAG_SIMILARITY_THRESHOLD = 0.5;

/** Жёсткий срок на весь поиск.
 *
 *  ЗАЧЕМ. computeEmbedding при отказе «слишком много запросов» СПИТ внутри
 *  запроса: 3 с, 10 с, 30 с, плюс собственный таймаут 25 с с одним повтором.
 *  Без срока первый же упёршийся в предел ученик ждал бы ответа помощника
 *  минуту и получил бы обрыв — то есть поиск по материалам сломал бы то, что
 *  до него работало. Срок держит худший случай в пределах, а не полагается на
 *  то, что модель всегда быстрая. Обычный ответ модели на вектор — 0.2-0.4 с,
 *  так что в норме срок не срабатывает никогда. */
const RAG_DEADLINE_MS = 4000;

type RetrievedChunk = {
  lesson_stage_id: string;
  chunk_text: string;
  similarity: number;
  lesson_id: string;
  lesson_topic: string | null;
  starts_at: string;
};

export type RagContext = {
  /** Готовый блок для системного промта. Пустая строка — не нашлось. */
  block: string;
  /** Сколько кусков ушло в промт (0 — не нашлось). */
  used: number;
  /** Сколько из них принадлежит текущему уроку. */
  fromThisLesson: number;
  /** Почему пусто — только для журнала сервера, ученику не показывается. */
  reason: "found" | "empty" | "no_match" | "embedding_failed" | "rpc_failed" | "timeout";
};

const EMPTY = (reason: RagContext["reason"]): RagContext => ({
  block: "",
  used: 0,
  fromThisLesson: 0,
  reason,
});

/** Ждёт обещанное не дольше срока. Проигравший таймер снимается, чтобы не
 *  держать процесс живым лишние секунды. */
function withDeadline(promise: Promise<RagContext>, ms: number): Promise<RagContext> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<RagContext>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[rag] поиск не уложился в ${ms} мс — отвечаем без выдержек`);
      resolve(EMPTY("timeout"));
    }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function retrieve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  question: string,
  lessonId: string | null,
  schoolId: string | null,
): Promise<RagContext> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await computeEmbedding(question, { schoolId });
  } catch (e) {
    // Модель недоступна/таймаут — помощник отвечает без выдержек.
    console.error("[rag] вектор вопроса не посчитан:", (e as Error)?.message);
    return EMPTY("embedding_failed");
  }

  // match_lesson_stage_embeddings — RPC миграции 139. Её нет в
  // сгенерированном Database-типе (@snr/core): типы отстают от базы, тот же
  // as-any приём, что уже принят в проекте для таких колонок и функций.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.rpc as any)("match_lesson_stage_embeddings", {
    p_query_embedding: queryEmbedding,
    p_match_count: RAG_FETCH_COUNT,
  });
  if (error) {
    console.error("[rag] поиск по векторам не прошёл:", error.message);
    return EMPTY("rpc_failed");
  }

  // Ученик без группы, ученик без проиндексированных материалов и вопрос не
  // по теме дают одно и то же — ноль подходящих кусков. Различать их
  // отдельным запросом незачем: ответ помощника во всех трёх случаях один.
  const passing = ((data ?? []) as RetrievedChunk[]).filter(
    (c) => c.similarity >= RAG_SIMILARITY_THRESHOLD,
  );
  if (passing.length === 0) return EMPTY("no_match");

  // Строки приходят от базы уже по убыванию совпадения (ORDER BY по
  // расстоянию внутри функции), поэтому обе половины сохраняют порядок.
  const here = lessonId ? passing.filter((c) => c.lesson_id === lessonId) : [];
  const others = passing.filter((c) => !lessonId || c.lesson_id !== lessonId);
  const picked = [...here, ...others].slice(0, RAG_TOP_K);

  const lines = picked.map((c, i) => {
    const own = lessonId != null && c.lesson_id === lessonId;
    const label = own
      ? "этот урок"
      : `урок «${c.lesson_topic ?? "без темы"}» от ${c.starts_at.slice(0, 10)}`;
    return `[Выдержка ${i + 1} — ${label}]\n${c.chunk_text}`;
  });

  const block = `
ВЫДЕРЖКИ ИЗ МАТЕРИАЛОВ. Ниже — дословный текст этапов уроков твоей группы,
найденный поиском по смыслу твоего вопроса. Опирайся на него и, если
отвечаешь по выдержке, скажи, из какого урока она взята.
${lines.join("\n\n")}`;

  return {
    block,
    used: picked.length,
    fromThisLesson: picked.filter((c) => lessonId != null && c.lesson_id === lessonId).length,
    reason: "found",
  };
}

/**
 * Ищет в проиндексированных материалах ученика куски, близкие к его вопросу.
 *
 * `db` — клиент ПОЛЬЗОВАТЕЛЯ (lib/supabase/server::createClient), не служебный.
 * Так задумано в миграции 139: match_lesson_stage_embeddings — SECURITY
 * DEFINER и берёт ученика не параметром, а изнутри, через
 * current_student_id() от auth.uid() текущей сессии. Отбор внутри функции идёт
 * по student_groups текущего ученика, поэтому чужая школа и чужая группа
 * отсекаются в самой базе, а не здесь.
 *
 * ВНИМАНИЕ ТОМУ, КТО БУДЕТ ПРАВИТЬ: подставить сюда служебный клиент —
 * ошибка, которую нечем заметить. Ошибки не будет, чужого не вернётся, просто
 * auth.uid() пуст, current_student_id() даёт NULL, и функция навсегда
 * возвращает ноль строк. Помощник молча останется без выдержек.
 *
 * `lessonId` — урок, внутри которого сидит ученик (null у общего помощника).
 * Его куски ставятся первыми: вопрос «а что тут написано» почти всегда про
 * текущий урок, а не про похожий прошлогодний.
 *
 * `schoolId` — только для учёта расходов, на отбор не влияет.
 */
export async function buildRagContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  userMessage: string,
  lessonId: string | null,
  schoolId: string | null = null,
): Promise<RagContext> {
  const question = userMessage.trim();
  if (!question) return EMPTY("empty");
  return withDeadline(retrieve(db, question, lessonId, schoolId), RAG_DEADLINE_MS);
}
