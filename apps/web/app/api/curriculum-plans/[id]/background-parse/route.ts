import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { разобратьВТемы } from "@/lib/curriculum-parse";
import { этоНашФайл, csvВТемы } from "@/lib/curriculum-csv";
import {
  updateCurriculumPlanProgress, markCurriculumPlanReady, markCurriculumPlanError,
  updateCurriculumPlanStage, markCurriculumPlanPreview,
} from "@snr/core";

// Большой фикс, Блок 6, ЗАДАЧА 1 — фоновый воркер парсинга учебного плана.
// Триггерится fire-and-forget'ом из create-processing/route.ts (или
// retry-parse/route.ts) — ОТДЕЛЬНЫЙ serverless-вызов, не await'ится
// вызывающей стороной, поэтому переживает закрытие вкладки учителем.
// Не сессионный (никаких куки от браузера) — авторизация через тот же
// CRON_SECRET, что Vercel Cron (apps/web/app/api/cron/*), переиспользован
// как общий "доверенный внутренний вызов" секрет, не заводим отдельный.

export const runtime = "nodejs";
// 07.08.2026: было 60 — и этого НЕ ХВАТАЛО. Живой прогон на реальном файле
// учителя (Робототехника 3-А) занял 65 секунд: скачивание из Storage +
// извлечение текста + до 3 попыток generateJSON с ретраями внутри
// gemini-client. На Vercel функция была бы убита на 60-й секунде ПОСЛЕ того,
// как progress уже сдвинулся на 30/60 — то есть план снова завис бы, просто
// на другом проценте, и снова без error_message (catch не успевает
// отработать при принудительном завершении). 300 — потолок Hobby-плана через
// Fluid Compute, тот же, что уже стоит у /api/cron/rag-process-queue и
// /api/stage-media/generate.
export const maxDuration = 300;


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: plan, error: planErr } = await anyDb
    .from("curriculum_plans")
    .select("id, source_file_url, source_book_id, status, subject_id, group_id")
    .eq("id", planId)
    .maybeSingle();
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  // Идемпотентно: если план уже не 'processing' (готов/ошибка от прошлого
  // вызова, или дублирующий триггер), второй раз не парсим.
  if (plan.status !== "processing") return NextResponse.json({ ok: true, skipped: true });

  // ДВА ИСТОЧНИКА, ОДИН РАЗБОРЩИК. Файл готового плана лежит в бакете
  // curriculum-plans, учебник — в books. Различаются они ровно здесь: где взять
  // байты и каким промптом их читать. Всё остальное — извлечение текста,
  // ретраи, нормализация тем, запись — общее. Второго разборщика нет и заводить
  // его незачем: темы в обоих случаях получаются одной формы, и дальше по ним
  // одинаково создаются уроки.
  const fromBook = Boolean(plan.source_book_id);

  try {
    if (!fromBook && !plan.source_file_url) throw new Error("У плана нет файла");

    // ── Скачивание ──────────────────────────────────────────────────────────
    // Стадия пишется НАСТОЯЩАЯ, а не примета: учебник на тридцать мегабайт
    // качается ощутимо долго, и учитель, глядя на застывший процент, решает,
    // что всё сломалось.
    await updateCurriculumPlanStage(db, planId, "download", 15);

    let buffer: Buffer;
    let sourceName: string;
    let bookTitle = "";
    let bookSubject = "";
    let grade = "—";
    if (fromBook) {
      const { data: book } = await anyDb
        .from("books").select("title, subject, file_storage_path").eq("id", plan.source_book_id).maybeSingle();
      if (!book?.file_storage_path) throw new Error("У выбранной книги нет файла");
      bookTitle = String(book.title ?? "Учебник");
      bookSubject = String(book.subject ?? "");
      sourceName = String(book.file_storage_path);
      const { data: fileData, error: dlErr } = await db.storage.from("books").download(sourceName);
      if (dlErr || !fileData) throw new Error("Не удалось скачать книгу из библиотеки");
      buffer = Buffer.from(await fileData.arrayBuffer());
      const { data: grp } = await anyDb.from("groups").select("name").eq("id", plan.group_id).maybeSingle();
      grade = String((grp as { name: string } | null)?.name ?? "—");
    } else {
      sourceName = plan.source_file_url as string;
      const { data: fileData, error: dlErr } = await db.storage.from("curriculum-plans").download(sourceName);
      if (dlErr || !fileData) throw new Error("Не удалось скачать файл плана");
      buffer = Buffer.from(await fileData.arrayBuffer());
    }

    // ── НАШ ФАЙЛ ЧИТАЕТСЯ БЕЗ МОДЕЛИ ────────────────────────────────────────
    //
    // Учитель принёс файл, который мы же ему и отдали кнопкой «Создать учебный
    // план»: темы в нём уже готовы. Звать модель второй раз — платить за то,
    // что посчитано. Признак — метка в первой строке; нет метки, файл чужой,
    // и он разбирается как раньше.
    if (!fromBook) {
      const текст = buffer.toString("utf-8");
      if (этоНашФайл(текст)) {
        const свои = csvВТемы(текст);
        if (свои.length === 0) throw new Error("В файле нет ни одной темы");
        await updateCurriculumPlanStage(db, planId, "save", 90);
        await markCurriculumPlanReady(db, planId, свои.map((t) => ({
          title: t.title, description: t.description, estimatedLessons: t.estimated_lessons,
        })));
        return NextResponse.json({ ok: true, topicsCount: свои.length, preview: false, ourFile: true });
      }
    }

    // ── Разбор ──────────────────────────────────────────────────────────────
    // Извлечение текста, промпт, модель и приведение тем к одной форме живут
    // в lib/curriculum-parse.ts — там же, откуда их берёт заказ на файл.
    // Второй копии этой цепочки в проекте нет.
    const topics = await разобратьВТемы(
      fromBook
        ? { вид: "книга", buffer, sourceName, bookTitle, subject: bookSubject, grade }
        : { вид: "файл-плана", buffer, sourceName },
      async (s) => {
        if (s === "extract") await updateCurriculumPlanStage(db, planId, "extract", 35);
        else if (s === "outline") await updateCurriculumPlanStage(db, planId, "outline", 50);
        else await updateCurriculumPlanStage(db, planId, "model", 65);
      },
    );

    await updateCurriculumPlanStage(db, planId, "save", 90);
    const rows = topics.map((t) => ({ title: t.title, description: t.description, estimatedLessons: t.estimated_lessons }));

    // Книга кончается ПРЕДПРОСМОТРОМ, а не готовым планом: темы предложены,
    // учитель их правит и подтверждает. Файл готового плана — как и был:
    // учитель уже принёс план, спрашивать согласия с собственным планом незачем.
    if (fromBook) await markCurriculumPlanPreview(db, planId, rows);
    else await markCurriculumPlanReady(db, planId, rows);

    return NextResponse.json({ ok: true, topicsCount: topics.length, preview: fromBook });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка парсинга";
    await markCurriculumPlanError(db, planId, message).catch(() => null);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
