// Пачка 5.1 — ручная разовая обработка ВСЕЙ lesson_stages_embedding_queue.
// Один вызов = один батч (20 записей) + остаток в ответе; вызывающий крутит
// цикл, пока remaining > 0. Экран — /admin/rag.
//
// 22.08.2026. Прежняя шапка ссылалась на крон /api/cron/rag-process-queue и
// просила «не убирать» его из vercel.json. Крона нет с 08.08.2026: он удалён
// вместе с роутом, когда пять кронов не влезли в два на бесплатном тарифе.
// Ссылка на несуществующее была ловушкой — по ней выходило, что очередь
// кто-то разбирает сам. Не разбирает никто: автоматического разбора у
// проекта сейчас нет вовсе, есть событие при создании/правке этапа
// (packages/core::requestStageIndexing) и эта кнопка.
//
// maxDuration ДОБАВЛЕН тем же числом. Его здесь не было вообще, то есть
// действовал предел по умолчанию, а батч из 20 записей идёт 20-25 секунд:
// вызов обрывался на середине, часть этапов оставалась с посчитанной
// половиной кусков. У соседнего /api/rag/process-stage предел стоит давно.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";
import { processEmbeddingQueueBatch, QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-embedding-queue";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 20;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole(supabase, user.id);
  // Z.1, 06.08.2026: super_admin убран из гейта — см. app/api/admin/chats/route.ts.
  // Тот же класс: глобальная очередь без школьного скоупа. Крон не задет.
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Школа админа — как в /api/admin/chats: строкой из admins, а не из
  // current_school_id(), потому что дальше работает служебный ключ.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adminRow } = await (supabase as any)
    .from("admins")
    .select("school_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const schoolId: string | null = adminRow?.school_id ?? null;
  if (!schoolId) {
    return NextResponse.json({ error: "No school" }, { status: 403 });
  }

  const db = createAdminClient();
  // lesson_stage_embeddings / lesson_stages_embedding_queue — таблицы
  // миграции 139, ещё не в сгенерированном Database-типе (@snr/core).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = db as any;

  let result;
  try {
    result = await processEmbeddingQueueBatch(ragDb, BATCH_LIMIT, schoolId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? String(e) }, { status: 500 });
  }

  // Остаток и итог — тоже по своей школе: числа на экране должны означать то
  // же самое, что делает кнопка.
  const [{ count: remaining }, { count: totalDone }] = await Promise.all([
    ragDb
      .from("lesson_stages_embedding_queue")
      .select("*", { count: "exact", head: true })
      .lt("attempts", QUEUE_MAX_ATTEMPTS)
      .eq("school_id", schoolId),
    ragDb
      .from("lesson_stage_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId),
  ]);

  return NextResponse.json({
    processed: result.processed,
    failed: result.errors,
    remaining: remaining ?? 0,
    total_done: totalDone ?? 0,
  });
}
