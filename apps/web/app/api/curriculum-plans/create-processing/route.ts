import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCurriculumPlanProcessing, replaceCurriculumPlanProcessing } from "@snr/core";

// Большой фикс, Блок 6, ЗАДАЧА 1 — заменяет старый флоу "распарсить →
// отредактировать темы → сохранить" (blocking 10-30с в модалке). Теперь:
// файл уже загружен в Storage клиентом (uploadCurriculumPlanFile, не
// меняется) → эта ручка мгновенно создаёт план со status='processing' →
// клиент редиректит на страницу плана → эта же ручка триггерит фоновый
// парсинг fire-and-forget'ом (не await!) на отдельный serverless-вызов,
// который переживёт закрытие вкладки учителем (см. background-parse/route.ts).

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    groupId?: string; subjectId?: string; storagePath?: string;
    sourceFileType?: string; title?: string; replaceExistingId?: string | null;
  } | null;
  const { groupId, subjectId, storagePath, sourceFileType, title, replaceExistingId } = body ?? {};
  if (!groupId || !subjectId || !storagePath || !sourceFileType || !title) {
    return NextResponse.json({ error: "groupId, subjectId, storagePath, sourceFileType, title required" }, { status: 400 });
  }
  if (sourceFileType !== "pdf" && sourceFileType !== "docx") {
    return NextResponse.json({ error: "sourceFileType must be pdf or docx" }, { status: 400 });
  }

  // Та же проверка владения, что parse/route.ts (RLS can_manage_curriculum_plan,
  // миграция 120): владелец — учитель предмета ИЛИ куратор группы.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: subject, error: subjectError }, { data: group, error: groupError }] = await Promise.all([
    (db as any).from("subjects").select("id, teacher_id").eq("id", subjectId).maybeSingle(),
    (db as any).from("groups").select("id, teacher_id").eq("id", groupId).maybeSingle(),
  ]);
  if (subjectError || groupError) {
    return NextResponse.json({ error: (subjectError ?? groupError)?.message ?? "Ошибка проверки доступа" }, { status: 500 });
  }
  const isSubjectOwner = subject?.teacher_id === teacher.id;
  const isGroupOwner = group?.teacher_id === teacher.id;
  if (!isSubjectOwner && !isGroupOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const input = {
    groupId, subjectId, teacherId: teacher.id, title,
    sourceFileUrl: storagePath, sourceFileType: sourceFileType as "pdf" | "docx",
  };

  let plan;
  try {
    plan = replaceExistingId
      ? await replaceCurriculumPlanProcessing(db, replaceExistingId, input)
      : await createCurriculumPlanProcessing(db, input);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка создания плана" }, { status: 500 });
  }

  if (process.env.CRON_SECRET) {
    fetch(`${req.nextUrl.origin}/api/curriculum-plans/${plan.id}/background-parse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch((e) => console.error("[create-processing] background-parse trigger failed:", e));
  } else {
    console.error("[create-processing] CRON_SECRET отсутствует — фоновый парсинг НЕ запущен, план останется в processing");
  }

  return NextResponse.json({ id: plan.id });
}
