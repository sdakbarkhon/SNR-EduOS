#!/usr/bin/env node
// Промт 7.3 Часть 6 (расширено Промтом 7.4) — сообщения в чатах,
// хардкод-шаблоны, без внешних API.
//
// Два режима:
// - без аргументов: исходное поведение Промта 7.3 — разово заполнить
//   ПУСТЫЕ треды (пропускает уже заполненные, идемпотентно).
// - node backfill-chat-messages.mjs <fromDate> <toDate>: Промт 7.4 —
//   "ежедневная жизнь платформы": для каждого дня диапазона добавляет
//   НОВЫЕ сообщения (не гейтится на "уже что-то есть", это ожидаемо —
//   после Промта 7.3 у всех тредов уже есть история) в случайную
//   подвыборку тредов, с датой в пределах конкретного дня.
import { makeServiceRoleClient, SCHOOL_ID, randomTimeBetween, pick, randomInt } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

function twoWeeksAgoIso() { return new Date(Date.now() - 14 * 86400000).toISOString(); }
function nowIso() { return new Date().toISOString(); }
function randomTimeWithinDay(dateStr) {
  return randomTimeBetween(`${dateStr}T00:00:00+05:00`, `${dateStr}T23:59:59+05:00`);
}
function addDaysStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function sampleN(arr, n) {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

// ── Диалоги для личных (direct) чатов — один случайный шаблон на чат ──
function dialog1(subjectName) {
  const n = randomInt(2, 5);
  return [
    { sender: "student", body: `Здравствуйте, я не понял задачу №${n} по ${subjectName}, можете помочь?` },
    { sender: "teacher", body: `Привет! Посмотри на слайд номер ${n} в презентации того урока, там всё разобрано. Если после этого не будет понятно — напиши, обсудим` },
    { sender: "student", body: "Спасибо, разобрался!" },
  ];
}
function dialog2() {
  return [
    { sender: "student", body: "Здравствуйте, я болел вчера, не смог прийти на урок" },
    { sender: "teacher", body: "Не переживай, зайди на страницу урока в системе — там вся теория и задание. Если что — пиши" },
    { sender: "student", body: "Понял, спасибо" },
  ];
}
function dialog3() {
  return [
    { sender: "teacher", body: "Молодец, отличная работа на уроке!" },
    { sender: "student", body: "Спасибо!" },
  ];
}
function dialog4(topicHint) {
  return [
    { sender: "student", body: "Здравствуйте, а когда следующая контрольная?" },
    { sender: "teacher", body: `На следующей неделе в четверг. Обязательно повтори тему ${topicHint}` },
    { sender: "student", body: "Хорошо, спасибо" },
  ];
}
function dialog5() {
  const n = randomInt(3, 12), m = randomInt(1, 6);
  return [
    { sender: "teacher", body: `Задание на завтра — прочитать параграф ${n} и сделать упражнение ${m}` },
    { sender: "student", body: "Ок понял" },
  ];
}

async function buildDirectMessages(subjectName, topicHint) {
  const dialogs = [dialog1(subjectName), dialog2(), dialog3(), dialog4(topicHint), dialog5()];
  return pick(dialogs);
}

// ── Пул реплик для группового чата ──
const STUDENT_LINES = [
  "Всем привет!",
  "Ребята, кто-нибудь понял третью задачу?",
  "Я понял, могу объяснить",
  "Спасибо!",
  "У кого есть учебник, поделитесь на завтра",
  "У меня есть, могу дать",
  "Спасибо большое",
  "А во сколько завтра урок?",
  "В 8:30, как обычно",
  "Кто сделал домашку? Можно свериться?",
  "Я почти закончил, скоро скину",
  "Может, кто-то объяснит вторую задачу?",
  "Давайте после уроков созвонимся",
  "Хорошая идея",
  "Не могу разобраться с последним пунктом",
  "Попробуй посмотреть видео с урока ещё раз",
];
const CURATOR_LINES = [
  "Напоминаю про завтрашнее собрание",
  "Не забудьте принести тетради",
  "Всем удачи на контрольной!",
  "Кто не сдал ещё домашку — сдайте до пятницы",
];

async function resolveDirectContext(t) {
  const [{ data: student }, { data: teacher }] = await Promise.all([
    db.from("students").select("user_id, id").eq("id", t.student_id).single(),
    db.from("teachers").select("user_id").eq("id", t.teacher_id).single(),
  ]);
  if (!student || !teacher) return null;

  const { data: sg } = await db.from("student_groups").select("group_id").eq("student_id", t.student_id).limit(1).maybeSingle();
  let subjectName = "предмет";
  let topicHint = "последнего урока";
  if (sg) {
    const { data: subj } = await db.from("subjects").select("name").eq("group_id", sg.group_id).eq("teacher_id", t.teacher_id).limit(1).maybeSingle();
    if (subj) subjectName = subj.name;
    const { data: lessons } = await db.from("lessons").select("topic").eq("group_id", sg.group_id).not("topic", "is", null).order("starts_at", { ascending: false }).limit(1);
    if (lessons?.[0]?.topic) topicHint = `«${lessons[0].topic}»`;
  }
  return { studentUserId: student.user_id, teacherUserId: teacher.user_id, subjectName, topicHint };
}

async function resolveGroupContext(t) {
  const { data: participants } = await db.from("chat_participants").select("user_id, role_in_thread").eq("thread_id", t.id);
  const curator = (participants ?? []).find((p) => p.role_in_thread === "curator");
  const studentUserIds = (participants ?? []).filter((p) => p.role_in_thread === "student").map((p) => p.user_id);
  if (!curator || studentUserIds.length === 0) return null;
  return { curatorUserId: curator.user_id, chosenStudents: sampleN(studentUserIds, 6) };
}

// Промт 7.4: ежедневная подсыпка сообщений в уже заполненные (Промтом 7.3)
// треды — для каждого дня диапазона в случайную подвыборку тредов.
async function runDailyTrickle(fromDate, toDate) {
  const { data: threads, error: threadsErr } = await db
    .from("chat_threads")
    .select("id, kind, group_id, student_id, teacher_id, title, school_id")
    .or("kind.eq.direct,kind.eq.group");
  if (threadsErr) throw threadsErr;

  const directThreads = threads.filter((t) => t.kind === "direct");
  const groupThreads = threads.filter((t) => t.kind === "group" && !(t.title ?? "").includes("Родители"));
  console.log(`direct-тредов: ${directThreads.length}, group-тредов (не родительских): ${groupThreads.length}`);

  let totalInserted = 0;
  let day = fromDate;
  while (day < toDate) {
    const rows = [];

    const dayDirect = sampleN(directThreads, randomInt(3, 5));
    for (const t of dayDirect) {
      const ctx = await resolveDirectContext(t);
      if (!ctx) continue;
      const dialog = await buildDirectMessages(ctx.subjectName, ctx.topicHint);
      const stamps = [...Array(dialog.length)].map(() => randomTimeWithinDay(day)).sort();
      for (let i = 0; i < dialog.length; i++) {
        rows.push({
          thread_id: t.id,
          sender_id: dialog[i].sender === "teacher" ? ctx.teacherUserId : ctx.studentUserId,
          body: dialog[i].body,
          created_at: stamps[i],
          school_id: t.school_id ?? SCHOOL_ID,
        });
      }
    }

    const dayGroups = sampleN(groupThreads, randomInt(1, Math.min(2, groupThreads.length)));
    for (const t of dayGroups) {
      const ctx = await resolveGroupContext(t);
      if (!ctx) continue;
      const msgCount = randomInt(2, 5);
      const stamps = [...Array(msgCount)].map(() => randomTimeWithinDay(day)).sort();
      for (let i = 0; i < msgCount; i++) {
        const isCurator = Math.random() < 0.2;
        rows.push({
          thread_id: t.id,
          sender_id: isCurator ? ctx.curatorUserId : pick(ctx.chosenStudents),
          body: isCurator ? pick(CURATOR_LINES) : pick(STUDENT_LINES),
          created_at: stamps[i],
          school_id: t.school_id ?? SCHOOL_ID,
        });
      }
    }

    if (rows.length) {
      const { error } = await db.from("chat_messages").insert(rows);
      if (error) { console.error(`  день ${day} упал: ${error.message}`); }
      else { totalInserted += rows.length; console.log(`  ${day}: +${rows.length} сообщений (${dayDirect.length} личных чатов, ${dayGroups.length} групповых)`); }
    }

    day = addDaysStr(day, 1);
  }

  console.log(`ИТОГО chat_messages вставлено (ежедневная подсыпка ${fromDate}..${toDate}): ${totalInserted}`);
}

async function fillEmptyThreads() {
  const { data: threads, error: threadsErr } = await db
    .from("chat_threads")
    .select("id, kind, group_id, student_id, teacher_id, title, school_id")
    .or("kind.eq.direct,kind.eq.group");
  if (threadsErr) throw threadsErr;

  const directThreads = threads.filter((t) => t.kind === "direct");
  const groupThreads = threads.filter((t) => t.kind === "group" && !(t.title ?? "").includes("Родители"));
  console.log(`direct-тредов: ${directThreads.length}, group-тредов (не родительских): ${groupThreads.length}`);

  const { data: existingMsgThreadIds } = await db.from("chat_messages").select("thread_id");
  const populated = new Set((existingMsgThreadIds ?? []).map((r) => r.thread_id));

  let directMessagesInserted = 0;
  let directThreadsFilled = 0;
  for (const t of directThreads) {
    if (populated.has(t.id)) continue;
    const [{ data: student }, { data: teacher }] = await Promise.all([
      db.from("students").select("user_id, id").eq("id", t.student_id).single(),
      db.from("teachers").select("user_id").eq("id", t.teacher_id).single(),
    ]);
    if (!student || !teacher) continue;

    const { data: sg } = await db.from("student_groups").select("group_id").eq("student_id", t.student_id).limit(1).maybeSingle();
    let subjectName = "предмет";
    let topicHint = "последнего урока";
    if (sg) {
      const { data: subj } = await db.from("subjects").select("name").eq("group_id", sg.group_id).eq("teacher_id", t.teacher_id).limit(1).maybeSingle();
      if (subj) subjectName = subj.name;
      const { data: lessons } = await db.from("lessons").select("topic").eq("group_id", sg.group_id).eq("status", "completed").not("topic", "is", null).order("starts_at", { ascending: false }).limit(1);
      if (lessons?.[0]?.topic) topicHint = `«${lessons[0].topic}»`;
    }

    const dialog = await buildDirectMessages(subjectName, topicHint);
    const stamps = [...Array(dialog.length)].map(() => randomTimeBetween(twoWeeksAgoIso(), nowIso())).sort();
    const rows = dialog.map((m, i) => ({
      thread_id: t.id,
      sender_id: m.sender === "teacher" ? teacher.user_id : student.user_id,
      body: m.body,
      created_at: stamps[i],
      school_id: t.school_id ?? SCHOOL_ID,
    }));
    const { error } = await db.from("chat_messages").insert(rows);
    if (error) { console.error(`  direct thread ${t.id} failed: ${error.message}`); continue; }
    directMessagesInserted += rows.length;
    directThreadsFilled++;
  }
  console.log(`direct: заполнено тредов ${directThreadsFilled}, сообщений вставлено ${directMessagesInserted}`);

  let groupMessagesInserted = 0;
  let groupThreadsFilled = 0;
  for (const t of groupThreads) {
    if (populated.has(t.id)) continue;
    const { data: participants } = await db.from("chat_participants").select("user_id, role_in_thread").eq("thread_id", t.id);
    const curator = (participants ?? []).find((p) => p.role_in_thread === "curator");
    const studentUserIds = (participants ?? []).filter((p) => p.role_in_thread === "student").map((p) => p.user_id);
    if (!curator || studentUserIds.length === 0) continue;

    const pool = [...studentUserIds];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, Math.min(6, pool.length));

    const msgCount = randomInt(15, 25);
    const stamps = [...Array(msgCount)].map(() => randomTimeBetween(twoWeeksAgoIso(), nowIso())).sort();
    const rows = [];
    for (let i = 0; i < msgCount; i++) {
      const isCurator = Math.random() < 0.2;
      rows.push({
        thread_id: t.id,
        sender_id: isCurator ? curator.user_id : pick(chosen),
        body: isCurator ? pick(CURATOR_LINES) : pick(STUDENT_LINES),
        created_at: stamps[i],
        school_id: t.school_id ?? SCHOOL_ID,
      });
    }
    const { error } = await db.from("chat_messages").insert(rows);
    if (error) { console.error(`  group thread ${t.id} failed: ${error.message}`); continue; }
    groupMessagesInserted += rows.length;
    groupThreadsFilled++;
  }
  console.log(`group: заполнено тредов ${groupThreadsFilled}, сообщений вставлено ${groupMessagesInserted}`);

  console.log(`ИТОГО chat_messages вставлено: ${directMessagesInserted + groupMessagesInserted}`);
}

async function main() {
  const [fromDate, toDate] = process.argv.slice(2, 4);
  if (fromDate && toDate) {
    await runDailyTrickle(fromDate, toDate);
  } else {
    await fillEmptyThreads();
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
