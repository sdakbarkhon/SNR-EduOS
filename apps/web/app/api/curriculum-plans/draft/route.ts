import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { заказБрошен, ПРИЧИНА_БРОШЕННОГО } from "@/lib/plan-draft-stale";

/**
 * ЗАКАЗ НА РАЗБОР УЧЕБНИКА. Кнопка «Создать учебный план». 06.09.2026.
 *
 * ═══ ЧЕМ ОТЛИЧАЕТСЯ ОТ create-from-book ═══════════════════════════════════
 *
 * Тем, что НЕ СОЗДАЁТ ПЛАН. Раньше эта кнопка заводила план и разбирала книгу
 * прямо в него; теперь она заводит ЗАКАЗ, фон складывает темы файлом, а план
 * появится потом — когда учитель принесёт этот файл второй кнопкой.
 *
 * Довод заказчика, и он верный: план, созданный «на всякий случай», занимает
 * пару (группа, предмет) и через месяц становится вопросом «почему у меня
 * висит недоделанный план».
 *
 * ═══ ДВОЙНОЕ НАЖАТИЕ ══════════════════════════════════════════════════════
 *
 * Разбор книги — самый дорогой вызов в проекте. Второе нажатие НЕ заводит
 * второй заказ: живой заказ на ту же четвёрку (учитель, книга, группа,
 * предмет) запрещён частичным уникальным индексом, и мы возвращаем тот, что
 * уже идёт. Проверка стоит ДО вставки (быстрый ответ) и ловится ПОСЛЕ неё
 * (две вкладки, нажавшие разом, до базы доходят одновременно).
 *
 * ═══ «УЖЕ ИДЁТ» — ТОЛЬКО ЕСЛИ ОН И ПРАВДА ИДЁТ ════════════════════════════
 *
 * Заказ, брошенный умершим фоном, в базе числится идущим до ночи, пока его не
 * добьёт сторож. Экран его идущим не считает и кнопку не гасит — значит и эта
 * ручка не имеет права отвечать «уже разбирается»: учитель нажал бы на живую
 * кнопку и получил отказ, которого не понимает. Брошенный заказ здесь
 * закрывается той же причиной, что пишет сторож, и на его месте заводится
 * новый — уникальный индекс к этому времени уже свободен.
 *
 * ═══ ПРО ЗАПУСК ФОНА ══════════════════════════════════════════════════════
 *
 * after() из next/server, как в create-processing и create-from-book. Голый
 * fetch без await на serverless умирает вместе с функцией — этим 07.08.2026
 * чинили «план висит на 10%». Не достучались до фона — заказ переводится в
 * отказ с причиной, а не висит вечно.
 */

export const runtime = "nodejs";
export const maxDuration = 15;

async function отказ(draftId: string, причина: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createAdminClient() as any)
      .from("curriculum_plan_drafts")
      .update({ status: "failed", error_message: причина, finished_at: new Date().toISOString() })
      .eq("id", draftId);
  } catch (e) {
    console.error("[draft] не удалось записать отказ:", (e as Error)?.message);
  }
}

function запуститьФон(origin: string, draftId: string) {
  after(async () => {
    if (!process.env.CRON_SECRET) return отказ(draftId, "Разбор не запустился: CRON_SECRET не задан");
    try {
      const res = await fetch(`${origin}/api/curriculum-plans/draft/${draftId}/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (!res.ok) await отказ(draftId, `Разбор не запустился: сервер ответил ${res.status}`);
    } catch (e) {
      await отказ(draftId, `Разбор не запустился: ${(e as Error)?.message ?? "сетевая ошибка"}`);
    }
  });
}

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const { data: teacher } = await anyDb
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  // ШКОЛА — ВЫБРАННАЯ, А НЕ ДОМАШНЯЯ. Здесь стояло teachers.school_id, и у
  // учителя двух школ заказ ложился в домашнюю: правило чтения меряет
  // current_school_id(), поэтому свой же заказ переставал ему показываться.
  // Колонка школы у заказов без умолчания, значит подставить её обязан код.
  const { data: школа } = await anyDb.rpc("current_school_id");
  if (!школа) return NextResponse.json({ error: "Не удалось определить школу" }, { status: 400 });

  const body = (await req.json()) as { groupId?: string; subjectId?: string; bookId?: string; title?: string };
  const groupId = body.groupId?.trim();
  const subjectId = body.subjectId?.trim();
  const bookId = body.bookId?.trim();
  if (!groupId || !subjectId || !bookId) {
    return NextResponse.json({ error: "Не выбрана группа, предмет или книга" }, { status: 400 });
  }

  // Права — та же проверка, что у создания плана из книги: владелец предмета
  // ИЛИ куратор группы, и предмет обязан относиться к этой группе.
  const [{ data: subject }, { data: group }] = await Promise.all([
    anyDb.from("subjects").select("id, teacher_id, group_id, name").eq("id", subjectId).maybeSingle(),
    anyDb.from("groups").select("id, teacher_id, name").eq("id", groupId).maybeSingle(),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const служебный = createAdminClient() as any;

  // Живой заказ на ту же четвёрку — возвращаем его, второй раз не платим.
  const { data: живой } = await служебный
    .from("curriculum_plan_drafts")
    .select("id, status, created_at")
    .eq("teacher_id", teacher.id).eq("book_id", bookId)
    .eq("group_id", groupId).eq("subject_id", subjectId)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (живой) {
    if (!заказБрошен(живой.created_at as string)) {
      return NextResponse.json({ id: живой.id, alreadyRunning: true });
    }
    // Брошенный — закрываем и заводим новый вместо него.
    await служебный
      .from("curriculum_plan_drafts")
      .update({ status: "failed", error_message: ПРИЧИНА_БРОШЕННОГО, finished_at: new Date().toISOString() })
      .eq("id", живой.id);
  }

  const title = body.title?.trim()
    || `${subject.name ?? "Предмет"} — ${group.name ?? "Группа"}`;

  const { data: draft, error } = await служебный
    .from("curriculum_plan_drafts")
    .insert({
      school_id: школа,
      teacher_id: teacher.id,
      group_id: groupId,
      subject_id: subjectId,
      book_id: bookId,
      title,
    })
    .select("id")
    .single();

  if (error || !draft) {
    // Единственная ожидаемая причина — тот же уникальный индекс: две вкладки
    // нажали разом. Отвечаем существующим заказом, а не ошибкой.
    const { data: гонка } = await служебный
      .from("curriculum_plan_drafts")
      .select("id")
      .eq("teacher_id", teacher.id).eq("book_id", bookId)
      .eq("group_id", groupId).eq("subject_id", subjectId)
      .in("status", ["queued", "running"])
      .maybeSingle();
    if (гонка) return NextResponse.json({ id: гонка.id, alreadyRunning: true });
    return NextResponse.json({ error: error?.message ?? "Не удалось создать заказ" }, { status: 500 });
  }

  запуститьФон(new URL(req.url).origin, draft.id as string);
  return NextResponse.json({ id: draft.id });
}
