// Пачка 5.1 — Задача D: ставит существующие lesson_stages (stage_role =
// 'middle' — единственное реальное значение, покрывающее theory/quiz/
// practice; 'start'/'summary' не индексируются) в очередь на
// переиндексацию для RAG. Сам эмбеддинг НЕ считает.
//
// 22.08.2026, ДВЕ ПРАВКИ.
//
// 1. ШКОЛА. Отбора по школе здесь не было вовсе: админ ЛЮБОЙ школы ставил в
//    очередь этапы ВСЕХ школ. Пока школа была одна, это ничего не значило.
//    Теперь их две, и разбор очереди (/api/admin/rag/process-batch) с того же
//    числа ограничен школой нажавшего — а постановка осталась общей. Связка
//    получалась несокращаемой: админ настоящей школы одним нажатием положил
//    бы в очередь 515 чужих этапов, и вынуть их не смог бы ни он (его разбор
//    их не видит), ни админ демо (его разбор видит только свои). Теперь оба
//    конца считают одну и ту же школу — ту, что записана у нажавшего в
//    admins.
//
// 2. ССЫЛКА НА НЕСУЩЕСТВУЮЩЕЕ. Шапка обещала, что векторы посчитает крон
//    /api/cron/rag-process-queue. Этого крона нет с 08.08.2026 — он удалён
//    вместе с роутом. Обещание было ловушкой: выходило, что достаточно
//    нажать эту кнопку. Не достаточно. Она ТОЛЬКО ставит в очередь; считает
//    векторы кнопка на /admin/rag (или разовый scripts/drain-rag-queue.ts).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole(supabase, user.id);
  // Z.1, 06.08.2026: super_admin убран из гейта — см. app/api/admin/chats/route.ts.
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Школа админа — строкой из admins, как в /api/admin/rag/process-batch и в
  // /api/admin/chats: дальше работает служебный ключ, и current_school_id()
  // под ним пуст.
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

  let body: { date_from?: string; date_to?: string; group_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // пустое тело допустимо — фильтров нет, ставим в очередь всё
  }
  const { date_from, date_to, group_id } = body;

  const db = createAdminClient();
  // lesson_stages_embedding_queue — новая таблица из миграции 139 (ещё не
  // применена), её нет в сгенерированном Database-типе. Join lessons!inner
  // тоже проще через any — тот же приём, что для video-колонок
  // lesson_materials (миграция 138).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ragDb = db as any;

  // lesson_stages <-> lessons имеет ДВА FK-пути (миграция 54 добавила
  // lessons.active_stage_id -> lesson_stages.id, "текущий активный этап
  // урока", в обратную сторону от естественного lesson_stages.lesson_id
  // -> lessons.id) — без явного hint PostgREST не может выбрать
  // однозначно и падает с "more than one relationship was found".
  // Явно указываем нужный FK: lesson_stages_lesson_id_fkey.
  // Фильтр по школе стоит на самом этапе, а не на его уроке: у lesson_stages
  // есть собственная колонка школы (её же кладёт в очередь строка ниже), и
  // сверка показала, что расхождений между школой этапа и школой урока в базе
  // нет ни одного. Отбор по своей колонке короче и не зависит от join.
  let query = ragDb
    .from("lesson_stages")
    .select("id, school_id, lesson_id, lessons!lesson_stages_lesson_id_fkey!inner(starts_at, group_id)")
    .eq("stage_role", "middle")
    .eq("school_id", schoolId);

  if (date_from) query = query.gte("lessons.starts_at", date_from);
  if (date_to) query = query.lte("lessons.starts_at", date_to);
  if (group_id) query = query.eq("lessons.group_id", group_id);

  const { data: stages, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!stages || stages.length === 0) {
    return NextResponse.json({ queued_count: 0 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = stages.map((s: any) => ({ lesson_stage_id: s.id, school_id: s.school_id }));

  // Батчами по 500, чтобы не упереться в лимит одного запроса.
  const CHUNK = 500;
  let queuedCount = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: upsertErr } = await ragDb
      .from("lesson_stages_embedding_queue")
      .upsert(chunk, { onConflict: "lesson_stage_id" });
    if (upsertErr) {
      return NextResponse.json(
        { error: upsertErr.message, queued_count: queuedCount },
        { status: 500 },
      );
    }
    queuedCount += chunk.length;
  }

  return NextResponse.json({ queued_count: queuedCount });
}
