#!/usr/bin/env node
// Промт 7.3 Часть 5 — объявления (школьные / классные / персональные).
//
// Учитывает фикс Промта 7.1: школьные (scope='all_my_groups' от админа)
// пишут created_by=NULL, admin_id=admin.id; классные/персональные пишут
// created_by=teacher.id, admin_id=NULL (announcements_author_check
// требует ровно одно из двух, миграция 121).
import { makeServiceRoleClient, SCHOOL_ID, randomTimeBetween, pick } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

const SCHOOL_TEMPLATES = [
  "Внимание! Завтра в 8:00 общее собрание в актовом зале",
  "Родительское собрание переносится на пятницу",
  "Не забудьте про экскурсию в понедельник",
  "Открыта запись в кружки на новый семестр",
  "Библиотека работает до 17:00 всю неделю",
];

const CLASS_TEMPLATES_BY_SUBJECT = (subject) => [
  `Завтра контрольная по ${subject}, повторите темы из последних 3 уроков`,
  "Приносите тетради на следующий урок",
];

const STUDENT_TEMPLATES = [
  "Прошу подойти после уроков для разговора",
  "Спасибо за хорошую работу на прошлом уроке",
];

function twoWeeksAgoIso() {
  return new Date(Date.now() - 14 * 86400000).toISOString();
}
function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const { data: adminRow, error: adminErr } = await db.from("admins").select("id").limit(1).maybeSingle();
  if (adminErr) throw adminErr;
  if (!adminRow) throw new Error("No admin row found — cannot create school-wide announcements");

  const { data: groups } = await db.from("groups").select("id, name, teacher_id");
  const { data: students } = await db.from("students").select("id, username").in("username", ["sherzod_10", "nodira_07", "aziz_03"]);

  const { data: beforeCount } = await db.from("announcements").select("id", { count: "exact", head: true });
  console.log(`announcements до backfill'а: ${beforeCount ?? "?"}`);

  const rows = [];

  // 3-5 школьных (админ)
  const schoolCount = 4;
  const shuffledSchool = [...SCHOOL_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, schoolCount);
  for (const text of shuffledSchool) {
    rows.push({
      scope: "all_my_groups",
      created_by: null,
      admin_id: adminRow.id,
      group_id: null,
      target_student_id: null,
      title: text.length > 60 ? text.slice(0, 57) + "..." : text,
      body: text,
      is_pinned: false,
      category: "general",
      is_ticker: false,
      school_id: SCHOOL_ID,
      created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
    });
  }

  // 2-3 классных (куратор) на каждый класс
  for (const g of groups ?? []) {
    if (!g.teacher_id) continue;
    const { data: subjects } = await db.from("subjects").select("name").eq("group_id", g.id).eq("teacher_id", g.teacher_id).limit(1);
    const subjectName = subjects?.[0]?.name ?? "предмету";
    const templates = CLASS_TEMPLATES_BY_SUBJECT(subjectName);
    const classCount = 2 + (Math.random() < 0.5 ? 1 : 0); // 2 или 3
    for (let i = 0; i < classCount; i++) {
      const text = templates[i % templates.length];
      rows.push({
        scope: "group",
        created_by: g.teacher_id,
        admin_id: null,
        group_id: g.id,
        target_student_id: null,
        title: text.length > 60 ? text.slice(0, 57) + "..." : text,
        body: text,
        is_pinned: false,
        category: "academic",
        is_ticker: false,
        school_id: SCHOOL_ID,
        created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
      });
    }
  }

  // 1-2 персональных на реального ученика (от куратора его класса)
  const curatorId = (groups ?? []).find((g) => g.teacher_id)?.teacher_id;
  for (const s of students ?? []) {
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const text = pick(STUDENT_TEMPLATES);
      rows.push({
        scope: "student",
        created_by: curatorId,
        admin_id: null,
        group_id: null,
        target_student_id: s.id,
        title: text.length > 60 ? text.slice(0, 57) + "..." : text,
        body: text,
        is_pinned: false,
        category: "general",
        is_ticker: false,
        school_id: SCHOOL_ID,
        created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
      });
    }
  }

  console.log(`Кандидатов на вставку: ${rows.length}`);
  const { data: inserted, error } = await db.from("announcements").insert(rows).select("id");
  if (error) throw error;
  console.log(`ИТОГО новых announcements вставлено: ${inserted?.length ?? 0}`);

  const { count: afterCount } = await db.from("announcements").select("id", { count: "exact", head: true });
  console.log(`announcements после backfill'а: ${afterCount}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
