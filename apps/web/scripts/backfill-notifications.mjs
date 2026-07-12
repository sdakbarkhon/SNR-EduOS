#!/usr/bin/env node
// Промт 7.3 Часть 4 — уведомления.
//
// Основная масса уведомлений уже появилась САМА через триггеры,
// сработавшие при вставках в Частях 1/3/5 (trg_lesson_grade_notify,
// trg_homework_submission_notify, trg_homework_grade_notify,
// fn_announce_notify) — этот скрипт (а) отчитывается по количеству
// уведомлений по типам (kind), чтобы подтвердить, что триггеры
// сработали, и (б) добавляет вручную то, для чего триггеров в принципе
// нет: общие напоминания об уроке и объявления админа об изменении
// расписания. is_demo-колонки на notifications нет (подтверждено —
// таблица не входит в список is_demo-таблиц миграции 110).
import { makeServiceRoleClient, SCHOOL_ID, randomTimeBetween } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

// Промт 7.3: notifications.kind имеет CHECK-constraint (обнаружено только
// при первом реальном INSERT — allowed: announcement, new_homework,
// new_grade, homework_graded, lesson_material, student_excused,
// student_submitted, leave_request, leave_decision, lesson_starting_soon,
// lesson_created, grade_received, announcement_new). Использую уже
// существующие значения вместо придуманных 'reminder'/'schedule_change' —
// lesson_starting_soon для напоминаний ровно по смыслу подходит;
// announcement_new (уже используется для "новое объявление от
// админа/учителя") — ближайший семантический аналог для
// admin-schedule-change пушей, не заводить отдельный enum-кейс ради двух
// шаблонов.
const REMINDER_KIND = "lesson_starting_soon";
const SCHEDULE_CHANGE_KIND = "announcement_new";

const REMINDER_TEMPLATES = [
  "Не забудь про завтрашний урок",
  "Урок начинается через час, не опаздывай",
  "Проверь расписание на завтра",
  "Скоро дедлайн по домашнему заданию",
  "Не забудь принести тетрадь на следующий урок",
  "Загляни в расписание — завтра сдвиг по времени",
];

const ADMIN_SCHEDULE_TEMPLATES = [
  "Внимание, изменение в расписании: перенос одного из уроков на следующей неделе",
  "Внимание, изменение в расписании: уточните время начала занятий в пятницу",
  "Внимание, изменение в расписании на следующей неделе — проверьте актуальное расписание",
];

function twoWeeksAgoIso() { return new Date(Date.now() - 14 * 86400000).toISOString(); }
function nowIso() { return new Date().toISOString(); }

const KNOWN_KINDS = [
  "announcement", "new_homework", "new_grade", "homework_graded", "lesson_material",
  "student_excused", "student_submitted", "leave_request", "leave_decision",
  "lesson_starting_soon", "lesson_created", "grade_received", "announcement_new",
];

// PostgREST caps unbounded .select() at 1000 rows — a plain select+client-count
// silently truncates once total notifications exceed that. Query each known
// kind's count individually (count:'exact', head:true) instead — accurate at
// any table size.
async function reportCountsByKind() {
  console.log("notifications по kind (после триггерных вставок Частей 1/3/5):");
  for (const kind of KNOWN_KINDS) {
    const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("kind", kind);
    if (count) console.log(`  ${kind}: ${count}`);
  }
}

async function main() {
  console.log("--- До ручных вставок ---");
  await reportCountsByKind();

  const { data: students } = await db.from("students").select("id, user_id, username").in("username", ["sherzod_10", "nodira_07", "aziz_03"]);
  if (!students?.length) throw new Error("Real students not found");

  const rows = [];

  // 5-8 общих напоминаний, распределены между реальными учениками
  const reminderCount = 6;
  for (let i = 0; i < reminderCount; i++) {
    const student = students[i % students.length];
    const text = REMINDER_TEMPLATES[i % REMINDER_TEMPLATES.length];
    rows.push({
      recipient_user_id: student.user_id,
      kind: REMINDER_KIND,
      title: text,
      body: null,
      link: "/schedule",
      source_id: null,
      school_id: SCHOOL_ID,
      created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
    });
  }

  // 2-3 уведомления от админа про изменение расписания — каждое всем 3 реальным ученикам
  for (const text of ADMIN_SCHEDULE_TEMPLATES) {
    for (const student of students) {
      rows.push({
        recipient_user_id: student.user_id,
        kind: SCHEDULE_CHANGE_KIND,
        title: text,
        body: null,
        link: "/schedule",
        source_id: null,
        school_id: SCHOOL_ID,
        created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
      });
    }
  }

  console.log(`Кандидатов на ручную вставку: ${rows.length}`);
  const { data: inserted, error } = await db.from("notifications").insert(rows).select("id");
  if (error) throw error;
  console.log(`ИТОГО вставлено вручную: ${inserted?.length ?? 0}`);

  console.log("--- После ручных вставок ---");
  await reportCountsByKind();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
