// Холостой прогон миграции 203: BEGIN … ROLLBACK.
// Демо-данные не меняем: все правки внутри транзакции и откатываются.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
const { Client } = pg;
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(WEB_ROOT, "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(WEB_ROOT, ".env.local"), "utf8").split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, "")]),
);
const db = new Client({ connectionString: env.SUPABASE_DB_URL });
await db.connect();
const say = (t) => console.log(`\n── ${t} ──`);

// Сколько записей окажется запертыми — считаем ДО применения.
say("сколько существующих записей окажутся запертыми (старше 15 минут)");
const counts = await db.query(`
  SELECT 'оценки за урок' AS вид,
         count(*)::int AS всего,
         count(*) FILTER (WHERE graded_at <= now() - interval '15 minutes')::int AS заперто
  FROM public.lesson_grades
  UNION ALL SELECT 'посещаемость', count(*)::int,
         count(*) FILTER (WHERE marked_at <= now() - interval '15 minutes')::int FROM public.attendance
  UNION ALL SELECT 'оценки за ДЗ', count(*)::int,
         count(*) FILTER (WHERE graded_at <= now() - interval '15 minutes')::int FROM public.homework_submissions
  UNION ALL SELECT 'оценки за тесты', count(*)::int,
         count(*) FILTER (WHERE graded_at <= now() - interval '15 minutes')::int FROM public.test_submissions
  UNION ALL SELECT 'этапы', count(*)::int,
         count(*) FILTER (WHERE graded_at <= now() - interval '15 minutes')::int FROM public.lesson_stage_progress`);
console.table(counts.rows);

await db.query("BEGIN");
try {
  await db.query(
    fs.readFileSync(path.join(ROOT, "supabase/migrations/203_lock_teacher_marks.sql"), "utf8")
      .replace(/^\s*NOTIFY pgrst.*$/gim, ""),
  );
  say("миграция выполнилась");

  const trg = await db.query(`
    SELECT tgrelid::regclass::text AS таблица FROM pg_trigger
    WHERE tgname='trg_lock_teacher_marks' AND NOT tgisinternal ORDER BY 1`);
  console.log("  триггер стоит на:", trg.rows.map((r) => r.таблица).join(", "));

  // Берём старую оценку демо-школы и учителя, который её ставил.
  const g = (await db.query(`
    SELECT lg.id, lg.grade, lg.comment, lg.graded_at, lg.school_id, t.user_id
    FROM public.lesson_grades lg JOIN public.teachers t ON t.id = lg.graded_by
    WHERE lg.graded_at < now() - interval '1 day' LIMIT 1`)).rows[0];
  const admin = (await db.query(
    `SELECT user_id FROM public.admins WHERE school_id=$1 LIMIT 1`, [g.school_id])).rows[0];

  const asUser = async (uid) => {
    await db.query("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: uid, role: "authenticated" })]);
  };
  const asService = async () => {
    await db.query("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claims', '', true)");
  };

  const attempt = async (title, fn) => {
    await db.query("SAVEPOINT s");
    let out = "прошло";
    try { await fn(); } catch (e) { out = "отказ — " + e.message.split("\n")[0].slice(0, 50); }
    await db.query("ROLLBACK TO SAVEPOINT s");
    console.log(`  ${title}: ${out}`);
  };

  say("учитель и старая оценка (поставлена давно)");
  await asUser(g.user_id);
  await attempt("меняет ОЦЕНКУ", () =>
    db.query(`UPDATE public.lesson_grades SET grade=$1 WHERE id=$2`, [(g.grade % 5) + 1, g.id]));
  await attempt("меняет КОММЕНТАРИЙ", () =>
    db.query(`UPDATE public.lesson_grades SET comment='правка текста' WHERE id=$1`, [g.id]));
  await asService();

  say("учитель и свежая оценка (только что поставлена)");
  await db.query("SAVEPOINT fresh");
  await db.query(`UPDATE public.lesson_grades SET graded_at = now() WHERE id=$1`, [g.id]);
  await asUser(g.user_id);
  await attempt("меняет оценку в течение 15 минут", () =>
    db.query(`UPDATE public.lesson_grades SET grade=$1 WHERE id=$2`, [(g.grade % 5) + 1, g.id]));
  await asService();
  await db.query("ROLLBACK TO SAVEPOINT fresh");

  say("администратор своей школы и та же старая оценка");
  await asUser(admin.user_id);
  await attempt("меняет оценку", () =>
    db.query(`UPDATE public.lesson_grades SET grade=$1 WHERE id=$2`, [(g.grade % 5) + 1, g.id]));
  await asService();

  say("автор не меняется при правке админом");
  await db.query("SAVEPOINT au");
  await asUser(admin.user_id);
  await db.query(`UPDATE public.lesson_grades SET grade=$1 WHERE id=$2`, [(g.grade % 5) + 1, g.id]);
  await asService();
  const after = (await db.query(
    `SELECT graded_by FROM public.lesson_grades WHERE id=$1`, [g.id])).rows[0];
  const teacher = (await db.query(
    `SELECT id FROM public.teachers WHERE user_id=$1`, [g.user_id])).rows[0];
  console.log(`  автор остался учителем: ${after.graded_by === teacher.id}`);
  await db.query("ROLLBACK TO SAVEPOINT au");

  say("автозавершение урока (служебный ключ, без сессии)");
  const att = (await db.query(`
    SELECT id, status FROM public.attendance WHERE marked_at < now() - interval '1 day' LIMIT 1`)).rows[0];
  await attempt("крон ставит is_finalized", () =>
    db.query(`UPDATE public.attendance SET is_finalized=true WHERE id=$1`, [att.id]));
  await attempt("крон меняет статус посещаемости", () =>
    db.query(`UPDATE public.attendance SET status = CASE WHEN status='present' THEN 'absent_unexcused' ELSE 'present' END WHERE id=$1`, [att.id]));

  say("выставление впервые не запирается — триггер только на UPDATE");
  const kind = await db.query(`
    SELECT tgrelid::regclass::text AS таблица,
           (tgtype & 4) > 0 AS на_insert,
           (tgtype & 16) > 0 AS на_update,
           (tgtype & 8) > 0 AS на_delete
    FROM pg_trigger WHERE tgname='trg_lock_teacher_marks' AND NOT tgisinternal ORDER BY 1`);
  console.table(kind.rows);

  // И тот же учитель на СВОЁМ уроке ставит оценку впервые.
  await db.query("SAVEPOINT ins");
  const les = (await db.query(`
    SELECT l.id, l.school_id, l.group_id FROM public.lessons l
    JOIN public.subjects s ON s.id = l.subject_id
    JOIN public.teachers t ON t.id = s.teacher_id
    WHERE t.user_id = $1
      AND NOT EXISTS (SELECT 1 FROM public.lesson_grades g
                      WHERE g.lesson_id = l.id AND g.student_id IN (
                        SELECT student_id FROM public.student_groups WHERE group_id = l.group_id))
    LIMIT 1`, [g.user_id])).rows[0];
  if (!les) {
    console.log("  у этого учителя все уроки уже с оценками — INSERT проверяем на другом");
  } else {
    const st = (await db.query(
      `SELECT student_id FROM public.student_groups WHERE group_id=$1 LIMIT 1`, [les.group_id])).rows[0];
    await asUser(g.user_id);
    await attempt("учитель ставит оценку впервые на своём уроке", () =>
      db.query(`INSERT INTO public.lesson_grades (lesson_id, student_id, grade, school_id, graded_by)
                VALUES ($1,$2,5,$3,(SELECT id FROM public.teachers WHERE user_id=$4))`,
        [les.id, st.student_id, les.school_id, g.user_id]));
    await asService();
  }
  await db.query("ROLLBACK TO SAVEPOINT ins");

} finally {
  await db.query("ROLLBACK");
  const trg = await db.query(`
    SELECT count(*)::int c FROM pg_trigger WHERE tgname='trg_lock_teacher_marks' AND NOT tgisinternal`);
  console.log(`\nROLLBACK — триггеров в базе после отката: ${trg.rows[0].c}`);
  await db.end();
}
