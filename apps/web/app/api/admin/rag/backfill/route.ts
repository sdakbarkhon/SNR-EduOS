// Пачка 5.1 — Задача D: ставит существующие lesson_stages (stage_role =
// 'middle' — единственное реальное значение, покрывающее theory/quiz/
// practice; 'start'/'summary' не индексируются) в очередь на
// переиндексацию для RAG. Сам эмбеддинг НЕ считает — это делает
// /api/cron/rag-process-queue (async, по расписанию).

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
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  let query = ragDb
    .from("lesson_stages")
    .select("id, school_id, lesson_id, lessons!lesson_stages_lesson_id_fkey!inner(starts_at, group_id)")
    .eq("stage_role", "middle");

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
