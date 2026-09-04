import { EXTERNAL_SERVICE_ORDER } from "./external-services";
import type { ExternalServiceType } from "@snr/core";

/**
 * СЕРВИСЫ ПРЕДМЕТА — ИЗ СПРАВОЧНИКА ШКОЛЫ. 06.09.2026, миграция 258.
 *
 * ═══ ЧТО БЫЛО ══════════════════════════════════════════════════════════════
 *
 * Карта в коде, ключуемая русским названием предмета: пять имён, и всё.
 * Предмет, которого в ней нет, получал четыре сервиса из четырнадцати —
 * так живут «Схемотехника», «Science» и любой предмет, который школа заведёт
 * завтра. Список за школу был решён в коде.
 *
 * ═══ ЧТО ТЕПЕРЬ ════════════════════════════════════════════════════════════
 *
 * Список лежит у предмета (`school_subjects.services`) и задаётся галочками.
 * Здесь только чтение: одна выборка на экран, без второй копии правила.
 *
 * ═══ ПОЧЕМУ ОТДЕЛЬНОЙ ВЫБОРКОЙ, А НЕ ПОЛЕМ В СОСЕДНЕЙ ══════════════════════
 *
 * Чтобы порядок выкатки ничего не ломал. Пока миграция не применена, колонки
 * нет: вплетённое поле уронило бы весь запрос экрана, а отдельная выборка
 * просто вернёт пусто — и сервисы покажутся ВСЕ. Показать лишнее на пару
 * минут безопасно, спрятать нужное — нет.
 */

/** Ключ — и id строки справочника, и её название: вызывающие знают разное. */
export type SubjectServices = Map<string, string[]>;

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Наборы сервисов предметов школы. Ошибка чтения — пустая карта, не бросок. */
export async function loadSubjectServices(db: any): Promise<SubjectServices> {
  const карта: SubjectServices = new Map();
  try {
    const { data, error } = await db
      .from("school_subjects").select("id, name, services");
    if (error) throw error;
    for (const r of ((data ?? []) as Array<{ id: string; name: string; services: string[] | null }>)) {
      const набор = r.services ?? [];
      if (набор.length === 0) continue;
      карта.set(r.id, набор);
      карта.set(r.name, набор);
    }
  } catch (e) {
    // Не роняем экран: без набора он покажет все сервисы, как и до 258.
    console.error("[subject-services] не удалось прочитать наборы:", e);
  }
  return карта;
}

/**
 * Сервисы для предмета. Набора нет (предмет не найден, колонка ещё не
 * заведена) — отдаём все: недостающего в списке не видно, а лишнее видно.
 *
 * Порядок всегда наш, EXTERNAL_SERVICE_ORDER, а не порядок хранения: иначе
 * форма перетасовывалась бы от того, в каком порядке админ ставил галочки.
 */
export function servicesForSubject(
  services: SubjectServices,
  key: string | null | undefined,
): ExternalServiceType[] {
  const набор = key ? services.get(key) : undefined;
  if (!набор || набор.length === 0) return EXTERNAL_SERVICE_ORDER;
  const множество = new Set(набор);
  return EXTERNAL_SERVICE_ORDER.filter((k) => множество.has(k));
}
