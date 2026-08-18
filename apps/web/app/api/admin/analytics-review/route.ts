import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMySchoolNow } from "@/lib/school-time-server";
import { generateText } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { buildAnalyticsReviewPrompt } from "@/lib/ai/prompts";
import { collectAnalyticsFacts } from "@/lib/analytics-facts";
import {
  computeOverall, computeStudentStats, computeGroupStats, computeSubjectStats,
  MIN_GRADES_FOR_VERDICT, EXCELLENT_FROM,
} from "@snr/core";

// Разбор аналитики от ИИ. Только для администратора школы.
//
// КОГДА СЧИТАЕМ ЗАНОВО. Разбор — это деньги, а данные между двумя заходами
// директора обычно те же. Правило:
//   * разбора нет — считаем;
//   * слепок чисел изменился И прошли сутки — считаем;
//   * нажали «Обновить» — считаем;
//   * иначе отдаём сохранённый.
// Почему не только слепок: в живой школе любая новая оценка двигает средний
// балл во втором знаке, и разбор пересчитывался бы по десять раз в день, слово
// в слово одинаковый. Почему не только сутки: в каникулы данные стоят, а мы бы
// платили ежедневно. Вместе — не чаще раза в сутки и только если есть чему
// меняться.
//
// РОДИТЕЛЬ И УЧЕНИК СЮДА НЕ ПОПАДАЮТ. Проверка роли стоит здесь, в роуте, а не
// только в интерфейсе; плюс правило чтения в базе (миграция 211) отдаёт строку
// только администратору своей школы.

const MIN_AGE_MS = 24 * 60 * 60 * 1000;

/** Слепок чисел, по которым сделан разбор. Огрубление намеренное: средний балл
 *  до сотых, посещаемость до целых — иначе слепок менялся бы от каждой оценки,
 *  а разбор от этого не меняется. */
function factsHash(parts: (string | number | null)[]): string {
  return parts.map((p) => (p == null ? "-" : String(p))).join("|");
}

export async function POST(req: NextRequest) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyDb = db as any;
  const { data: admin } = await anyDb.from("admins").select("id, school_id").eq("user_id", user.id).maybeSingle();
  if (!admin?.school_id) return NextResponse.json({ error: "Not an admin" }, { status: 403 });
  const schoolId = admin.school_id as string;

  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean } | null;
    force = body?.force === true;
  } catch { /* тела нет — обычный заход */ }

  const schoolNow = await getMySchoolNow(db);
  const todayIso = schoolNow.toISOString().slice(0, 10);

  // Факты и расчёты — те же, что рисуют экран. Своего способа посчитать
  // средний балл у разбора нет: разойдись он с таблицей, директор увидел бы
  // текст, противоречащий числам над ним.
  const facts = await collectAnalyticsFacts(db, todayIso);
  const input = { grades: facts.grades, attendance: facts.attendance, submitted: facts.submitted, overdue: facts.overdue };

  const overall = computeOverall(input);
  const stats = computeStudentStats(input, facts.students.map((s) => s.id));
  const studentsByGroup = new Map<string, number>();
  for (const s of facts.students) studentsByGroup.set(s.groupName, (studentsByGroup.get(s.groupName) ?? 0) + 1);
  const groups = computeGroupStats(input, studentsByGroup);
  const subjects = computeSubjectStats(input);

  const atRisk = stats.filter((s) => s.risks.length > 0);
  const excellent = stats.filter((s) => !s.tooLittleData && (s.avgGrade ?? 0) >= EXCELLENT_FROM);
  const tooLittle = stats.filter((s) => s.tooLittleData).length;
  const nameOf = new Map(facts.students.map((s) => [s.id, s.name]));

  // Данных мало — это состояние всей школы, а не отдельного ученика: если
  // больше половины учеников не набрали порога, разбирать нечего.
  const enoughData = overall.gradeCount >= 50 && tooLittle < facts.students.length / 2;

  const hash = factsHash([
    overall.avgGrade?.toFixed(2) ?? null,
    overall.attendance,
    overall.gradeCount,
    overall.submitted,
    overall.overdue,
    atRisk.length,
    excellent.length,
    groups.length,
    subjects.map((s) => `${s.subject}:${s.avgGrade?.toFixed(1) ?? "-"}`).join(","),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = createAdminClient() as any;
  const { data: cached } = await store
    .from("school_analytics_reviews")
    .select("review_text, facts_hash, generated_at")
    .eq("school_id", schoolId)
    .maybeSingle();

  const ageMs = cached?.generated_at ? Date.now() - new Date(cached.generated_at).getTime() : Infinity;
  const stale = !cached || (cached.facts_hash !== hash && ageMs >= MIN_AGE_MS);

  if (cached && !stale && !force) {
    return NextResponse.json({
      text: cached.review_text, generatedAt: cached.generated_at, fresh: false, enoughData,
    });
  }

  // ── Собираем сводку для модели ────────────────────────────────────────────
  const lines = [
    `Период: по ${todayIso} включительно (дата школы).`,
    `Всего учеников: ${facts.students.length}. Оценок в расчёте: ${overall.gradeCount}.`,
    `Средний балл по школе: ${overall.avgGrade?.toFixed(2) ?? "нет данных"}. Посещаемость: ${overall.attendance ?? "нет данных"}%.`,
    `Работ сдано: ${overall.submitted}. Просрочено: ${overall.overdue}.`,
    ``,
    `ПО ГРУППАМ:`,
    ...groups.map((g) => `- ${g.groupName}: балл ${g.avgGrade?.toFixed(2) ?? "—"}, посещаемость ${g.attendance ?? "—"}%, учеников ${g.studentCount}, оценок ${g.gradeCount}`),
    ``,
    `ПО ПРЕДМЕТАМ (от худшего к лучшему):`,
    ...subjects.map((s) => `- ${s.subject || "без предмета"}: балл ${s.avgGrade?.toFixed(2) ?? "—"}, посещаемость ${s.attendance ?? "—"}%, оценок ${s.gradeCount}`),
    ``,
    `УЧЕНИКИ, КОТОРЫМ НУЖНА ПОДДЕРЖКА (${atRisk.length}):`,
    ...(atRisk.length === 0 ? ["- таких нет"] : atRisk.slice(0, 12).map((s) =>
      `- ${nameOf.get(s.studentId) ?? "—"}: балл ${s.avgGrade?.toFixed(2) ?? "—"}, посещаемость ${s.attendance ?? "—"}%, несдано ${s.overdueCount}, признаки: ${s.risks.join(", ")}`)),
    ``,
    `УЧЕНИКИ С ЛУЧШИМИ РЕЗУЛЬТАТАМИ: ${excellent.length}.`,
    `Учеников, по которым данных мало (меньше ${MIN_GRADES_FOR_VERDICT} оценок): ${tooLittle}.`,
    ``,
    `ЗАМЕТНО ИЗМЕНИЛИСЬ:`,
    ...(() => {
      const moved = stats.filter((s) => s.trend != null && Math.abs(s.trend) >= 0.5);
      return moved.length === 0 ? ["- таких нет"] : moved.slice(0, 8).map((s) =>
        `- ${nameOf.get(s.studentId) ?? "—"}: ${s.trend! > 0 ? "+" : ""}${s.trend!.toFixed(2)} балла`);
    })(),
  ];

  const { text, error } = await generateText(buildAnalyticsReviewPrompt(lines.join("\n"), enoughData), {
    maxTokens: 1400,
    temperature: 0.6,
    // Flash — «думающая» модель: без этого «мышление» съедает весь бюджет
    // вывода, и разбор обрывается на первом предложении. Проверено: 775
    // входных токенов, 34 выходных, текст в 174 символа. Тот же приём, что у
    // факта дня (api/daily-fact).
    thinkingBudget: 0,
    usage: { task: AI_TASKS.analyticsReview, schoolId },
  });

  if (error || !text.trim()) {
    // Модель не ответила — отдаём прошлый разбор, если он был. Пустой экран
    // хуже вчерашнего текста, лишь бы он был подписан датой.
    if (cached) {
      return NextResponse.json({
        text: cached.review_text, generatedAt: cached.generated_at, fresh: false, enoughData,
        warning: error ?? "AI не ответил",
      });
    }
    return NextResponse.json({ error: error || "AI не ответил" }, { status: 503 });
  }

  const generatedAt = new Date().toISOString();
  const { error: saveErr } = await store
    .from("school_analytics_reviews")
    .upsert({ school_id: schoolId, review_text: text.trim(), facts_hash: hash, model: "gemini-2.5-flash", generated_at: generatedAt },
      { onConflict: "school_id" });
  if (saveErr) {
    // Не сохранилось — разбор всё равно отдаём. Потеряется только кэш, и в
    // следующий раз посчитаем заново.
    console.error("[analytics-review] не сохранился:", saveErr.message);
  }

  return NextResponse.json({ text: text.trim(), generatedAt, fresh: true, enoughData });
}
