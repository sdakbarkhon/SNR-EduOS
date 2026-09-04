import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCurriculumPlanProcessing, replaceCurriculumPlanProcessing, markCurriculumPlanError } from "@snr/core";

// Большой фикс, Блок 6, ЗАДАЧА 1 — заменяет старый флоу "распарсить →
// отредактировать темы → сохранить" (blocking 10-30с в модалке). Теперь:
// файл уже загружен в Storage клиентом (uploadCurriculumPlanFile, не
// меняется) → эта ручка мгновенно создаёт план со status='processing' →
// клиент редиректит на страницу плана → эта же ручка триггерит фоновый
// парсинг fire-and-forget'ом (не await!) на отдельный serverless-вызов,
// который переживёт закрытие вкладки учителем (см. background-parse/route.ts).

export const runtime = "nodejs";
export const maxDuration = 15;

/** 07.08.2026 — фикс «план висит на 10%».
 *
 *  Было: голый `fetch(...)` без await. На serverless функция замораживается
 *  сразу после возврата ответа, и незавершённый запрос умирает вместе с ней —
 *  background-parse не вызывался НИ РАЗУ. Симптом ровно этот: план остаётся
 *  на progress_percent=10 (значение, выставленное здесь) с error_message=NULL,
 *  потому что background-parse ставит 30 ПЕРЕД первым обращением к Gemini,
 *  то есть до его try-блока дело не доходило вообще.
 *
 *  Стало: after() из next/server — тот же приём, что уже используется в
 *  apps/web/app/actions/auth.ts для освобождения демо-слота. Ответ уходит
 *  клиенту сразу, а функция живёт до завершения колбэка.
 *
 *  Плюс: если триггер всё-таки не сработал (нет CRON_SECRET, сеть, не-2xx),
 *  план переводится в status='error' с текстом. Раньше в этом случае он
 *  висел в 'processing' бесконечно и учитель видел вечный спиннер. */
function triggerBackgroundParse(origin: string, planId: string, label: string) {
  after(async () => {
    const fail = async (reason: string) => {
      console.error(`[${label}] background-parse trigger failed:`, reason);
      try {
        await markCurriculumPlanError(createAdminClient(), planId, `Не удалось запустить разбор файла: ${reason}`);
      } catch (e) {
        console.error(`[${label}] markCurriculumPlanError also failed:`, (e as Error)?.message);
      }
    };

    if (!process.env.CRON_SECRET) return fail("CRON_SECRET не задан");

    try {
      const res = await fetch(`${origin}/api/curriculum-plans/${planId}/background-parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      // background-parse сам пишет ошибку в план при сбое парсинга; сюда
      // попадаем только если не достучались до него (401/404/5xx).
      if (!res.ok) await fail(`background-parse ответил ${res.status}`);
    } catch (e) {
      await fail((e as Error)?.message ?? "сетевая ошибка");
    }
  });
}

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
  if (sourceFileType !== "pdf" && sourceFileType !== "docx" && sourceFileType !== "csv") {
    return NextResponse.json({ error: "sourceFileType must be pdf, docx or csv" }, { status: 400 });
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
    sourceFileUrl: storagePath,
    // CSV ЛОЖИТСЯ ПУСТЫМ ТИПОМ. Колонка source_file_type знает только pdf и
    // docx — проверка стоит в базе с миграции 116, а наш файл плана появился
    // позже. Расширять её ради поля, которое НИГДЕ не читается, значит заводить
    // миграцию на пустом месте: расширение видно в source_file_url, а «наш это
    // файл или чужой» разборщик определяет по метке внутри файла.
    sourceFileType: sourceFileType === "csv" ? null : (sourceFileType as "pdf" | "docx"),
  };

  let plan;
  try {
    plan = replaceExistingId
      ? await replaceCurriculumPlanProcessing(db, replaceExistingId, input)
      : await createCurriculumPlanProcessing(db, input);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка создания плана" }, { status: 500 });
  }

  triggerBackgroundParse(req.nextUrl.origin, plan.id, "create-processing");

  return NextResponse.json({ id: plan.id });
}
