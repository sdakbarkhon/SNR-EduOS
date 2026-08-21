import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Журнал действий суперадминистратора — врезка в одно место.
 *
 * ГЛАВНОЕ ПРАВИЛО: запись делается ДО действия. Не легла — действие не
 * выполняется. Отсюда читается просто: ЗАПИСИ НЕТ, ЗНАЧИТ И ДЕЙСТВИЯ НЕ БЫЛО.
 *
 * Почему не «сделали, потом записали»: откатить постфактум физически нельзя.
 * Удаление школы сносит строки в базе, файлы в хранилище и учётки в auth —
 * три разные системы, одной транзакции над ними не существует. Журнал, который
 * можно обойти сбоем, окажется пустым ровно в тот раз, когда он нужен.
 *
 * ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ — промежуток до применения миграции 220. Код уезжает
 * на прод раньше неё, и в этом промежутке функции в базе ещё нет. Тогда мы
 * ПУСКАЕМ и пишем предупреждение в лог: кнопки суперадмина не должны
 * сломаться ни на секунду. Любой ДРУГОЙ отказ базы — это отказ действия.
 *
 * СЕКРЕТЫ. Наружу отсюда уходит не форма целиком, а перечисленные вызывающим
 * поля. Второй рубеж стоит в самой базе: journal_assert_no_secrets падает,
 * увидев ключ, похожий на секрет, — и тогда действие не выполнится.
 */

/** Виды действий. Тот же перечень закреплён проверкой в миграции 220: список
 *  здесь и там обязан совпадать, иначе база отвергнет запись, а действие не
 *  выполнится. Это осознанно — журнал не должен молча принимать неизвестное. */
export type JournalAction =
  | "school.create"
  | "school.update"
  | "school.archive"
  | "school.delete"
  | "admin.create"
  | "admin.update"
  | "admin.delete"
  | "admin.reset_password"
  | "self.google_email"
  | "self.password"
  | "access.denied"
  /** Вход в школу на просмотр (миграция 221). */
  | "school.visit";

export type JournalOutcome = "started" | "done" | "failed" | "denied";

export type JournalEntry = {
  action: JournalAction;
  actorUserId?: string | null;
  actorName?: string | null;
  targetType?: "school" | "admin" | "self" | null;
  targetId?: string | null;
  targetName?: string | null;
  /** ТОЛЬКО перечисленные поля. Форму целиком сюда не передавать никогда. */
  details?: Record<string, unknown>;
};

/** Отказы НАШЕЙ проверки. Их пишем как «отказано», всё остальное — как
 *  «не удалось»: техническая поломка не поступок человека. */
const ОТКАЗЫ = new Set([
  "Not super admin",
  "Unauthorized",
  "Missing fields",
  "Password too short",
  "Школа не найдена",
  "Администратор не найден",
  "demo_school_cannot_be_deleted",
  "school_name_mismatch",
]);

function текстОшибки(e: unknown): string {
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : String(e ?? "");
}

/** true — отказала наша проверка, а не сломалась техника. */
export function этоОтказПроверки(e: unknown): boolean {
  return ОТКАЗЫ.has(текстОшибки(e));
}

/** PostgREST не нашёл функцию (PGRST202) или Postgres не нашёл (42883) —
 *  значит миграция 220 ещё не применена. Тот же приём, что в
 *  packages/core/src/queries/index.ts и lib/rate-limit.ts. */
function функцииНет(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? "";
  const msg = текстОшибки(e);
  return code === "PGRST202" || code === "42883" || /Could not find the function/i.test(msg);
}

let предупредили = false;

/**
 * Пишет строку журнала. Возвращает её номер — он нужен, чтобы строка об
 * отказе сослалась на строку о начале.
 *
 * Бросает, если база отказала. Вызывающий обязан НЕ выполнять действие.
 * Не бросает в одном случае — функции ещё нет (миграция не применена).
 */
export async function journalWrite(
  entry: JournalEntry & { outcome: JournalOutcome; ref?: number | null },
): Promise<number | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data, error } = await db.rpc("superadmin_journal_write", {
    p_action: entry.action,
    p_outcome: entry.outcome,
    p_actor_user_id: entry.actorUserId ?? null,
    p_actor_name: entry.actorName ?? null,
    p_target_type: entry.targetType ?? null,
    p_target_id: entry.targetId ?? null,
    p_target_name: entry.targetName ?? null,
    p_details: entry.details ?? {},
    p_ref: entry.ref ?? null,
  });

  if (error) {
    if (функцииНет(error)) {
      if (!предупредили) {
        предупредили = true;
        console.warn(
          "[journal] миграция 220 ещё не применена — действия суперадмина " +
          "выполняются без записи в журнал. Это временно, до применения.",
        );
      }
      return null;
    }
    // Любой другой отказ — это отказ действия. Наверх уходит понятная причина.
    console.error("[journal] запись не легла, действие отменяется:", error.message ?? error);
    throw new Error("journal_write_failed");
  }
  return typeof data === "number" ? data : null;
}

/**
 * Обёртка вокруг действия: сперва запись, потом действие.
 *
 * Порядок именно такой и переставлять его нельзя — на нём держится правило
 * «записи нет, значит и действия не было».
 */
export async function withJournal<T>(
  entry: JournalEntry,
  run: () => Promise<T>,
  /**
   * Что запомнить об итоге. Задаётся только там, где результат несёт сведения,
   * которых до действия не было: номер заведённой школы, сколько файлов и
   * учёток унесло удаление. Для остальных кнопок второй строки не пишем —
   * запоминать после них нечего, а лишние строки только зашумят журнал.
   */
  итог?: (r: T) => { targetId?: string | null; details?: Record<string, unknown> },
): Promise<T> {
  const id = await journalWrite({ ...entry, outcome: "started" });
  try {
    const r = await run();
    if (итог) {
      const d = итог(r);
      // Действие уже состоялось, откатывать нечего: если эта строка не ляжет,
      // молчим в лог. Главную гарантию даёт строка «начато», она уже стоит.
      await journalWrite({
        ...entry, outcome: "done", ref: id,
        targetId: d.targetId ?? entry.targetId ?? null,
        details: d.details ?? {},
      }).catch(() => null);
    }
    return r;
  } catch (e) {
    // Строка об отказе не должна подменять собой настоящую ошибку: что бы с
    // ней ни случилось, наверх уходит то, из-за чего действие сорвалось.
    await journalWrite({
      ...entry,
      outcome: этоОтказПроверки(e) ? "denied" : "failed",
      ref: id,
      details: { ...(entry.details ?? {}), reason: текстОшибки(e).slice(0, 300) },
    }).catch(() => null);
    throw e;
  }
}

/**
 * Вход суперадмина в школу на просмотр.
 *
 * ЕДИНСТВЕННОЕ ДЕЙСТВИЕ, КОТОРОЕ НЕ ОТМЕНЯЕТСЯ ИЗ-ЗА ЖУРНАЛА, и это осознанно.
 * Правило «не легло — не выполняем» защищает от бесследных ИЗМЕНЕНИЙ; здесь же
 * человек ничего не меняет, а только смотрит. Запереть просмотр из-за того, что
 * не записалась строка, значило бы поменять работающий надзор на молчаливый
 * журнал — обмен не в нашу пользу.
 *
 * До применения миграции 221 вид действия 'school.visit' проверке в таблице
 * незнаком, и запись отобьётся ПОНЯТНОЙ ошибкой (superadmin_journal_action_check),
 * а не тихо. Мы её ловим, пишем в лог и пускаем человека смотреть.
 */
export async function journalSchoolVisit(
  actor: { id: string; name: string },
  school: { id: string; name: string | null },
): Promise<void> {
  try {
    await journalWrite({
      action: "school.visit",
      outcome: "started",
      actorUserId: actor.id,
      actorName: actor.name,
      targetType: "school",
      targetId: school.id,
      targetName: school.name,
    });
  } catch (e) {
    console.warn(
      "[journal] вход в школу не записан (миграция 221 ещё не применена?): " +
      (текстОшибки(e) || "неизвестно") + ". Просмотр при этом разрешён.",
    );
  }
}

/** Кто-то вошёл, но суперадмином не является. Самая интересная строка в
 *  журнале, поэтому пишется отдельно, до броска ошибки.
 *
 *  Незалогиненных сюда не пишем намеренно: это не «попытка не того человека»,
 *  а обычный запрос без сессии, и писать их значило бы отдать журнал во власть
 *  того, кто дёргает адрес в цикле. */
export async function journalAccessDenied(userId: string, what: string): Promise<void> {
  await journalWrite({
    action: "access.denied",
    outcome: "denied",
    actorUserId: userId,
    targetType: null,
    details: { attempted: what },
  }).catch(() => null);
}
