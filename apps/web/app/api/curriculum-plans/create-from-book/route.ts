import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCurriculumPlanFromBook, replaceCurriculumPlanFromBook, markCurriculumPlanError,
} from "@snr/core";

// Учебный план из книги: создаёт заготовку и запускает разбор.
//
// ЭТО НЕ ВТОРОЙ СПОСОБ СОЗДАНИЯ ПЛАНА. Ручка отличается от create-processing
// ровно одним: источником. Дальше работает тот же background-parse, тот же
// формат тем, те же уроки по темам. Отдельная ручка нужна лишь потому, что у
// книги нет загружаемого файла — она уже лежит в библиотеке, и грузить её
// второй раз было бы издевательством над учителем с тридцатимегабайтным PDF.
//
// ПРО ЗАПУСК ФОНА. after() из next/server, а не голый fetch. Это ровно тот
// фикс, которым 07.08.2026 чинили «план висит на 10%»: на serverless функция
// замораживается сразу после ответа, и незавершённый запрос умирает вместе с
// ней — background-parse не вызывался НИ РАЗУ. Повторять эту ошибку в новом
// пути нельзя, поэтому здесь тот же приём и та же страховка: не достучались до
// разборщика — план переводится в 'error' с текстом, а не висит вечно.

export const runtime = "nodejs";
export const maxDuration = 15;

function triggerBackgroundParse(origin: string, planId: string) {
  after(async () => {
    const fail = async (reason: string) => {
      console.error("[create-from-book] background-parse trigger failed:", reason);
      try {
        await markCurriculumPlanError(createAdminClient(), planId, `Не удалось запустить разбор книги: ${reason}`);
      } catch (e) {
        console.error("[create-from-book] markCurriculumPlanError also failed:", (e as Error)?.message);
      }
    };

    if (!process.env.CRON_SECRET) return fail("CRON_SECRET не задан");

    try {
      const res = await fetch(`${origin}/api/curriculum-plans/${planId}/background-parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
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
  const anyDb = db as any;
  const { data: teacher } = await anyDb.from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const body = (await req.json()) as {
    groupId?: string; subjectId?: string; bookId?: string; title?: string; replaceExistingId?: string | null;
  };
  const groupId = body.groupId?.trim();
  const subjectId = body.subjectId?.trim();
  const bookId = body.bookId?.trim();
  if (!groupId || !subjectId || !bookId) {
    return NextResponse.json({ error: "Не выбрана группа, предмет или книга" }, { status: 400 });
  }

  // Права — та же проверка, что у остальных действий с планами: владелец
  // предмета ИЛИ куратор группы. Предмет обязан относиться к этой группе.
  const [{ data: subject }, { data: group }] = await Promise.all([
    anyDb.from("subjects").select("id, teacher_id, group_id").eq("id", subjectId).maybeSingle(),
    anyDb.from("groups").select("id, teacher_id").eq("id", groupId).maybeSingle(),
  ]);
  if (!subject || !group) return NextResponse.json({ error: "Группа или предмет не найдены" }, { status: 404 });
  if (subject.group_id !== groupId) {
    return NextResponse.json({ error: "Этот предмет не относится к выбранной группе" }, { status: 403 });
  }
  if (subject.teacher_id !== teacher.id && group.teacher_id !== teacher.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Книга читается ПОД СЕССИЕЙ УЧИТЕЛЯ: правила доступа отсекут чужую школу
  // сами, и подсунуть идентификатор чужой книги не выйдет.
  const { data: book } = await anyDb
    .from("books").select("id, title, file_storage_path").eq("id", bookId).maybeSingle();
  if (!book) return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
  if (!book.file_storage_path) {
    return NextResponse.json({ error: "У этой книги нет файла — разобрать нечего" }, { status: 400 });
  }

  const input = {
    groupId, subjectId, teacherId: teacher.id as string,
    title: body.title?.trim() || `${book.title}`,
    bookId,
  };

  let planId: string;
  try {
    const plan = body.replaceExistingId
      ? await replaceCurriculumPlanFromBook(db, body.replaceExistingId, input)
      : await createCurriculumPlanFromBook(db, input);
    planId = plan.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать план";
    // Уникальность (group_id, subject_id) — единственная ожидаемая причина:
    // план на эту пару уже есть, и клиент должен спросить про замену.
    return NextResponse.json({ error: message }, { status: 409 });
  }

  triggerBackgroundParse(new URL(req.url).origin, planId);
  return NextResponse.json({ id: planId });
}
