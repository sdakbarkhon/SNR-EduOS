import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { разобратьВТемы } from "@/lib/curriculum-parse";
import { темыВCsv } from "@/lib/curriculum-csv";
import { schoolStoragePath } from "@snr/core";

/**
 * ФОН ЗАКАЗА: книга -> темы -> ФАЙЛ. 06.09.2026.
 *
 * Отдельный serverless-вызов, не привязанный к вкладке учителя: закрыл её —
 * разбор идёт дальше, вернулся — файл на месте. Тот же приём и тот же секрет,
 * что у background-parse; своего секрета не заводим.
 *
 * ═══ ЗА СОБОЙ НЕ ОСТАВЛЯЕТ МУСОРА ═════════════════════════════════════════
 *
 * Три места, где всё может кончиться: книга не прочиталась, модель не
 * ответила, файл не записался. В каждом заказ переводится в 'failed' с
 * ПРИЧИНОЙ словами, а файла не остаётся: любой отказ сносит за собой всё, что
 * успел занять. Полуготового файла не бывает — либо он записан целиком и путь
 * проставлен, либо его нет вовсе.
 *
 * ═══ МЕСТО ПОД ФАЙЛ ЗАНИМАЕТСЯ ДО РАЗБОРА ═════════════════════════════════
 *
 * Разбор книги — самый дорогой вызов в проекте, а хранилище умеет отказать:
 * не тот тип файла, кончилось место, бакет настроен иначе, чем мы думаем.
 * Узнать об этом ПОСЛЕ разбора значит заплатить за темы и выбросить их. Перед
 * разбором мы пишем в конечный путь пустышку в несколько байт: приняло —
 * примет и настоящий файл; отказало — заказ падает сразу, не потратив ни
 * копейки. Пустышка снимается вместе с заказом при любом отказе.
 *
 * ═══ ИДЕМПОТЕНТНОСТЬ ══════════════════════════════════════════════════════
 *
 * Заказ не в 'queued' второй раз не берётся. Дублирующий триггер уходит ни с
 * чем — как и у разбора плана.
 */

export const runtime = "nodejs";
// Столько же, сколько у background-parse: живой прогон разбора книги занимал
// 65 секунд, а потолок тарифа — 300.
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: draftId } = await params;
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;

  const { data: draft, error: draftErr } = await anyDb
    .from("curriculum_plan_drafts")
    .select("id, school_id, teacher_id, group_id, book_id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (draftErr) return NextResponse.json({ error: draftErr.message }, { status: 500 });
  if (!draft) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (draft.status !== "queued") return NextResponse.json({ ok: true, skipped: true });

  const шаг = async (stage: string, percent: number) => {
    await anyDb.from("curriculum_plan_drafts")
      .update({ status: "running", progress_stage: stage, progress_percent: percent })
      .eq("id", draftId);
  };
  // ПУТЬ СОБИРАЕТСЯ ОБЩЕЙ ФУНКЦИЕЙ, А НЕ СТРОКОЙ НА МЕСТЕ. Соглашение из
  // packages/core/src/storage/path.ts: первый сегмент — школа, дальше как
  // раньше. Без префикса файл считался бы наследием демо-школы, а правило
  // «своей папки» отсчитывало бы владельца не от того сегмента.
  const путь = schoolStoragePath(String(draft.school_id), String(draft.teacher_id), "drafts", `${draftId}.csv`);
  // Занято ли место под файл: если да, любой отказ обязан его освободить.
  let занято = false;
  const отказ = async (причина: string) => {
    if (занято) {
      await db.storage.from("curriculum-plans").remove([путь]).catch(() => null);
      занято = false;
    }
    await anyDb.from("curriculum_plan_drafts")
      .update({ status: "failed", error_message: причина, finished_at: new Date().toISOString() })
      .eq("id", draftId);
    return NextResponse.json({ error: причина }, { status: 500 });
  };

  try {
    // ── Книга ──────────────────────────────────────────────────────────────
    await шаг("download", 15);
    const { data: book } = await anyDb
      .from("books").select("title, subject, file_storage_path").eq("id", draft.book_id).maybeSingle();
    if (!book?.file_storage_path) return отказ("У выбранной книги нет файла");

    const { data: файл, error: dlErr } = await db.storage
      .from("books").download(String(book.file_storage_path));
    if (dlErr || !файл) return отказ("Не удалось скачать книгу из библиотеки");

    const { data: группа } = await anyDb
      .from("groups").select("name").eq("id", draft.group_id).maybeSingle();

    // ── Место под файл ─────────────────────────────────────────────────────
    // Пустышка в конечный путь — проверка, что хранилище вообще примет наш
    // файл. Дешевле разбора на несколько порядков и делается ДО него.
    const { error: резервErr } = await db.storage
      .from("curriculum-plans")
      .upload(путь, new Blob([""], { type: "text/csv; charset=utf-8" }), {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
      });
    if (резервErr) return отказ(`Хранилище не принимает файл плана: ${резервErr.message}`);
    занято = true;

    // ── Разбор ─────────────────────────────────────────────────────────────
    // Проценты те же, что у разбора плана: человек видит один и тот же ход,
    // какой бы кнопкой ни начал.
    const темы = await разобратьВТемы(
      {
        вид: "книга",
        buffer: Buffer.from(await файл.arrayBuffer()),
        sourceName: String(book.file_storage_path),
        bookTitle: String(book.title ?? "Учебник"),
        subject: String(book.subject ?? ""),
        grade: String((группа as { name: string } | null)?.name ?? "—"),
      },
      async (s) => {
        if (s === "extract") await шаг("extract", 35);
        else if (s === "outline") await шаг("outline", 50);
        else await шаг("model", 65);
      },
    );

    // ── Файл ───────────────────────────────────────────────────────────────
    // Занятая пустышка перезаписывается настоящими темами. Путь проставляется
    // в той же записи, что и «готово», — раньше него файла для учителя нет.
    await шаг("file", 90);
    const { error: upErr } = await db.storage
      .from("curriculum-plans")
      .upload(путь, new Blob([темыВCsv(темы)], { type: "text/csv; charset=utf-8" }), {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
      });
    if (upErr) return отказ(`Не удалось записать файл: ${upErr.message}`);

    await anyDb.from("curriculum_plan_drafts").update({
      status: "done",
      progress_percent: 100,
      progress_stage: null,
      result_path: путь,
      topics_count: темы.length,
      finished_at: new Date().toISOString(),
    }).eq("id", draftId);

    return NextResponse.json({ ok: true, topicsCount: темы.length });
  } catch (e) {
    // Причина уходит учителю КАК ЕСТЬ: «модель не ответила», «из книги не
    // удалось извлечь текст». «Не вышло» человеку ничего не говорит.
    return отказ(e instanceof Error ? e.message : "Неизвестная ошибка разбора");
  }
}
