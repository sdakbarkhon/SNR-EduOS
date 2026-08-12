"use server";

import { createClient } from "@/lib/supabase/server";
import { childInsight, getSelectedChildId, type ParentInsight } from "@/lib/parent-queries";
import { buildParentInsight, normalizeInsightLocale, type InsightPayload } from "@/lib/ai/parent-insight";

/**
 * Собрать разбор помощника по выбранному ребёнку.
 *
 * Тонкая обёртка над `lib/ai/parent-insight.ts` — тем же кодом, которым
 * пользуется мобильный маршрут. Отличие ровно одно: здесь клиент базы
 * cookie-шный (родитель уже вошёл в вебе), а там — bearer.
 *
 * Разбор считает модель, поэтому действие запускается ТОЛЬКО по нажатию
 * кнопки на экране, а не при его открытии: иначе каждый заход родителя
 * дёргал бы модель. Свежий разбор (моложе недели) отдаётся из базы без
 * обращения к модели вовсе.
 */
export async function generateParentInsight(
  locale: string,
  force = false,
): Promise<{ ok: true; payload: InsightPayload; generatedAt: string; cached: boolean } | { ok: false; error: string }> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const childId = await getSelectedChildId();
  if (!childId) return { ok: false, error: "no_child" };

  const result = await buildParentInsight(db, {
    userId: user.id,
    childId,
    locale: normalizeInsightLocale(locale),
    force,
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, payload: result.payload, generatedAt: result.generatedAt, cached: result.cached };
}

/**
 * Прочитать сохранённый разбор на нужном языке — без обращения к модели.
 *
 * Нужен экрану, когда у родителя выбран не русский: серверная страница читает
 * разбор на языке по умолчанию, а язык живёт в браузере. Ничего не пишет и
 * ничего не генерирует.
 */
export async function readParentInsight(locale: string): Promise<ParentInsight | null> {
  return childInsight(normalizeInsightLocale(locale));
}
