// Разборщик очереди наполнения уроков этапами. Заход Q2, 03.09.2026.
//
// ЧТО ДЕЛАЕТ, ПО ШАГАМ:
//   1. берёт самую старую строку в состоянии 'queued' с attempts < 2;
//   2. помечает её 'running' — второй разборщик её уже не возьмёт;
//   3. зовёт СУЩЕСТВУЮЩИЙ маршрут /api/ai/generate-stages служебным входом;
//   4. кладёт этапы общей функцией applyGeneratedStages (той же, что и окно);
//   5. помечает строку 'done' — или считает попытку и пишет причину.
//
// ПОЧЕМУ ЧЕРЕЗ HTTP, А НЕ ВЫЗОВОМ ФУНКЦИИ. Промт, модель и разбор ответа
// живут внутри маршрута, и вытаскивать их оттуда значило бы трогать промт —
// чего делать нельзя. Маршрут остаётся единственным местом, где живёт
// генерация; у него просто появился второй вход (заход Q2).
//
// ПОЧЕМУ ПО ОДНОЙ СТРОКЕ ЗА ВЫЗОВ. Один урок — до трёх обращений к модели и до
// шести картинок, потолок маршрута 300 секунд. Два урока в одну функцию не
// влезают гарантированно, а обрыв посреди вставки оставил бы урок с половиной
// этапов. Пачка набирается повторными вызовами: их крутит либо кнопка, либо
// расписание (заход Q3).

import { createAdminClient } from "@/lib/supabase/admin";
import { applyGeneratedStages, describeError, getSchoolLessonDuration, type GeneratedStage } from "@snr/core";

/** Две попытки — решение заказчика. Внутри маршрута уже до трёх обращений к
 *  модели, три попытки очереди сверху дали бы девять на урок. */
export const STAGE_GEN_MAX_ATTEMPTS = 2;

export type DrainOutcome =
  | { kind: "empty" }
  | { kind: "done"; lessonId: string; inserted: number; removed: number; ms: number }
  | { kind: "failed"; lessonId: string; reason: string; attemptSpent: boolean; ms: number };

type QueueRow = {
  lesson_id: string;
  school_id: string;
  requested_by: string;
  topic: string | null;
  attempts: number;
  options: Record<string, unknown> | null;
};

/**
 * Отличает исчерпанную квоту от прочих бед.
 *
 * ЗАЧЕМ. Решение заказчика: квота попытку НЕ тратит. Повторять сегодня
 * бессмысленно — модель откажет снова, — а счётчик за это тратить нельзя,
 * иначе после двух суток с исчерпанной квотой урок выпадет из разбора
 * навсегда, ни разу не будучи испробованным по-настоящему.
 *
 * Тот же вывод уже сделан на экране разбора векторов: «весь заход упал —
 * дальше давить бессмысленно».
 */
function isQuotaError(text: string): boolean {
  return /429|quota|rate.?limit|resource[_ ]exhausted/i.test(text);
}

/**
 * Разобрать ОДНУ строку очереди.
 *
 * `baseUrl` — адрес своего же приложения: маршрут генерации зовётся по HTTP.
 * На Vercel это VERCEL_URL, локально — NEXT_PUBLIC_SITE_URL.
 */
export async function drainOneStageGenJob(baseUrl: string): Promise<DrainOutcome> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const startedMs = Date.now();

  const { data: rows, error: readErr } = await anyDb
    .from("lesson_stage_gen_queue")
    .select("lesson_id, school_id, requested_by, topic, attempts, options")
    .eq("status", "queued")
    .lt("attempts", STAGE_GEN_MAX_ATTEMPTS)
    .order("enqueued_at", { ascending: true })
    .limit(1);
  if (readErr) throw new Error(readErr.message);

  const job = ((rows ?? []) as QueueRow[])[0];
  if (!job) return { kind: "empty" };

  // Занимаем строку. Условие status='queued' в самом UPDATE — защита от двух
  // разборщиков разом: второй обновит ноль строк и уйдёт ни с чем.
  const { data: taken } = await anyDb
    .from("lesson_stage_gen_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("lesson_id", job.lesson_id)
    .eq("status", "queued")
    .select("lesson_id");
  if (!((taken ?? []) as unknown[]).length) return { kind: "empty" };

  const провал = async (reason: string, attemptSpent: boolean): Promise<DrainOutcome> => {
    const attempts = job.attempts + (attemptSpent ? 1 : 0);
    // Попытки кончились — строка становится 'failed' и больше не берётся.
    // Квота попытку не тратит, поэтому по ней строка возвращается в 'queued'
    // и подождёт следующего запуска.
    const status = attemptSpent && attempts >= STAGE_GEN_MAX_ATTEMPTS ? "failed" : "queued";
    await anyDb.from("lesson_stage_gen_queue").update({
      status, attempts, last_error: reason.slice(0, 500),
      started_at: null,
      finished_at: status === "failed" ? new Date().toISOString() : null,
    }).eq("lesson_id", job.lesson_id);
    return { kind: "failed", lessonId: job.lesson_id, reason, attemptSpent, ms: Date.now() - startedMs };
  };

  try {
    // Предмет и длительность — те же источники, что у одиночного наполнения.
    const { data: lesson } = await anyDb
      .from("lessons")
      .select("group_id, title, topic, subject:subjects(name)")
      .eq("id", job.lesson_id).maybeSingle();
    if (!lesson) return провал("Урок не найден", true);

    const subjectName = (lesson as { subject?: { name: string } | null }).subject?.name ?? "";
    const lessonMinutes = await getSchoolLessonDuration(db, job.school_id);
    const topic = job.topic
      ?? (lesson as { topic?: string | null; title?: string | null }).topic
      ?? (lesson as { title?: string | null }).title
      ?? "";
    if (!topic.trim()) return провал("У урока нет темы — генерировать не по чему", true);

    const options = (job.options ?? {}) as { difficulty?: string; useWebSearch?: boolean };

    const res = await fetch(`${baseUrl}/api/ai/generate-stages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({
        lesson_id: job.lesson_id,
        teacher_id: job.requested_by,
        topic,
        duration_min: lessonMinutes,
        overall_difficulty: options.difficulty ?? "medium",
        use_web_search: options.useWebSearch ?? true,
      }),
    });

    const текст = await res.text();
    if (!res.ok) {
      // Квота — не наша вина и не повод тратить попытку.
      return провал(текст.slice(0, 300) || `HTTP ${res.status}`, !isQuotaError(текст) && res.status !== 429);
    }

    const data = JSON.parse(текст) as { stages?: GeneratedStage[]; error?: unknown };
    if (data.error) {
      const причина = describeError(data.error);
      return провал(причина, !isQuotaError(причина));
    }
    if (!data.stages?.length) return провал("Модель вернула пустой список этапов", true);

    // ПЕРЕЗАПОЛНЕНИЕ. Урок мог быть уже наполнен — стираем середину и кладём
    // заново. «Старт» и «Итог» не трогаются: их кладёт триггер, они не
    // содержимое. Окно шага 2 предупреждает об этом числом до нажатия.
    const итог = await applyGeneratedStages(db, {
      lessonId: job.lesson_id,
      teacherId: job.requested_by,
      lessonMinutes,
      subjectName,
      stages: data.stages,
      replaceExisting: true,
      // Школа — обязательна: разборщик ходит служебным ключом, а у четырёх
      // таблиц на этом пути school_id NOT NULL с умолчанием
      // current_school_id(), которое под служебным ключом пусто.
      schoolId: job.school_id,
    });

    await anyDb.from("lesson_stage_gen_queue").update({
      status: "done", finished_at: new Date().toISOString(),
      attempts: job.attempts + 1, last_error: null,
    }).eq("lesson_id", job.lesson_id);

    return {
      kind: "done", lessonId: job.lesson_id,
      inserted: итог.inserted, removed: итог.removed, ms: Date.now() - startedMs,
    };
  } catch (e) {
    // ПРИЧИНУ НЕ ГЛОТАТЬ. 03.09.2026: здесь стояло String(e), и первый же
    // настоящий прогон записал в очередь «[object Object]» — потому что
    // supabase-js бросает не Error, а обычный объект с полями message,
    // code, details. Разбор занял отдельную пробу, которой не понадобилось
    // бы, скажи запись правду сразу.
    // Правило разбора уехало в ядро (describeError): экран очереди из захода
    // Q4 ловит ТОТ ЖЕ вид ошибки, и второй копии здесь быть не должно.
    const текст = describeError(e);
    // Сеть и таймаут попытку тратят — решение заказчика.
    return провал(текст, !isQuotaError(текст));
  }
}


/** Сколько строк ещё ждёт разбора. */
export async function countQueuedStageGenJobs(): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { count } = await db
    .from("lesson_stage_gen_queue")
    .select("lesson_id", { count: "exact", head: true })
    .eq("status", "queued")
    .lt("attempts", STAGE_GEN_MAX_ATTEMPTS);
  return count ?? 0;
}
