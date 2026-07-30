#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 11 — живые чаты (групповые + direct), объявления,
// уведомления. Шаблоны, без AI.
//
// ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки схемы + существующих
// backfill-chat-messages.mjs / backfill-announcements.mjs /
// backfill-notifications.mjs):
//
//  1) ГРУППОВЫХ ТРЕДОВ НЕ 3, А 6: миграция 81 добавила ВТОРОЙ 'group'-тред
//     на класс — родительский ("<класс> — Родители", curator+2 parent).
//     Различать НАДО НЕ ПО TITLE (в проде у всех 3 родительских тредов
//     title побит по кодировке — decode в replacement-символы вместо
//     "— Родители", подтверждено live-запросом), А ПО СОСТАВУ
//     chat_participants: ученический тред = curator+10 student, родительский
//     = curator+2 parent. Заполняются только 3 ученических (curator+10
//     student) — ровно то, что просил промт.
//
//  2) "Предметники" технически НЕ являются chat_participants группового
//     треда (только curator+students) — но chat_messages.sender_id не
//     имеет FK на chat_participants (миграция 78), отправить сообщение от
//     имени предметника технически можно и без формального участия.
//     Используется именно так — предметники дают "напоминания про уроки"
//     без добавления их в chat_participants (не меняем модель доступа).
//
//  3) ИДЕМПОТЕНТНОСТЬ ЧАТОВ — по треду (есть ли уже хоть одно сообщение),
//     тот же приём, что и в существующем backfill-chat-messages.mjs
//     (fillEmptyThreads). На момент запуска chat_messages пуст (0 строк) —
//     подтверждено live.
//
//  4) ЧАСТЬ C (УВЕДОМЛЕНИЯ) — ГЛАВНОЕ РАСХОЖДЕНИЕ: создание уведомлений в
//     реальном приложении ЦЕЛИКОМ триггерное (fn_homework_notify,
//     fn_lesson_grade_notify, fn_homework_submission_notify и т.д.) — нет
//     ни одной app-level функции createNotification/notifyX нигде в
//     packages/core. Из-за этого 4 из 5 категорий, которые просил промт,
//     УЖЕ ПОЛНОСТЬЮ (и многократно) созданы САМИ, как побочный эффект
//     инсертов в предыдущих Этапах этой же регенерации (Этап 7 — ДЗ, Этап
//     9 — оценки, Этап 7/9 fix — сдачи):
//       - "новое ДЗ" (kind=new_homework)      — уже 552 записи (~18/ученика, промт просил 3-5)
//       - "оценка" (grade_received — new_grade в CHECK есть, но реально
//         никогда не используется триггерами, 0 записей везде)
//                                              — уже 648 записей (~21/ученика, промт просил 1-3)
//       - "сдано ДЗ" учителю (student_submitted) — уже 310 записей (~52/учителя, промт просил 5-10)
//     Досоздавать эти 3 категории поверх — не восстановление недостающего,
//     а дублирование уже (в разы) избыточного объёма; не делаю.
//     - "новое сообщение в чате" учителю — ТАКОГО kind вообще НЕТ в CHECK-
//     констрейнте notifications_kind_check (13 допустимых значений,
//     миграция 20260624000049_notify_fixes.sql) — физически невозможно
//     без новой миграции (добавление enum-значения), вне области "только
//     скрипт" этого промта. Пропущено, не выдумываю несуществующий kind.
//     - "посещаемость" родителю (student_excused) — единственная РЕАЛЬНО
//     пустая (0 записей) и осмысленно бэкфилящаяся категория — attendance
//     Этапа 8 создавался прямым INSERT в обход какого-либо notify-триггера
//     (если он вообще существует для attendance — не найден ни один
//     fn_*attendance*notify* по всей истории миграций). Бэкфиллится для 3
//     реальных родителей (Ismailov Bakhtiyor/Rakhimov Odil/Karimov Sardor).
//
//  5) Объявления (Часть B) НЕ дублируют попытку notification'ов — insert в
//     announcements сам вызовет fn_announce_notify (реальный DB-триггер),
//     'announcement'/'announcement_new' появятся автоматически, без ручной
//     вставки — проверено в финальном отчёте скрипта.
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-chats-announcements-notifications.mjs

import { makeServiceRoleClient, SCHOOL_ID, pick, randomInt, randomTimeBetween } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
function fail(msg) { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); }

function twoWeeksAgoIso() { return new Date(Date.now() - 14 * 86400000).toISOString(); }
function nowIso() { return new Date().toISOString(); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ═══════════════════════════ ЧАСТЬ A.1 — ГРУППОВЫЕ ЧАТЫ ═══════════════════
const CURATOR_LINES = [
  "Ребята, завтра классный час в 14:00 в кабинете",
  "Напоминаю про завтрашнее собрание",
  "Не забудьте про экскурсию",
  "Собираем 10 000 сум на подарок ветерану, сдайте старосте",
  "Не забудьте принести тетради",
  "Всем удачи на контрольной!",
  "Кто не сдал ещё домашку — сдайте до пятницы",
  "Отлично поработали сегодня!",
  "Завтра встречаемся на 10 минут раньше",
  "Родители интересуются успеваемостью — подтяните хвосты",
];
const TEACHER_LINES = [
  "Кто ещё не сдал ДЗ? Напоминаю про дедлайн",
  "Завтра принесите учебники на урок",
  "Не забудьте про тест на следующей неделе",
  "Напоминаю про дедлайн по проекту",
  "Хорошо поработали на уроке сегодня",
  "Домашнее задание уже доступно в системе",
];
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
  "А кто со мной идёт после?",
  "Я тоже",
  "Кто идёт на экскурсию?",
  "Я записался",
];

async function fillGroupThreads() {
  const { data: threads, error } = await db.from("chat_threads").select("id, title, group_id, school_id").eq("school_id", SCHOOL_ID).eq("kind", "group");
  if (error) fail(`Ошибка запроса group chat_threads: ${error.message}`);

  const { data: existingThreadIds } = await db.from("chat_messages").select("thread_id").in("thread_id", threads.map((t) => t.id));
  const populated = new Set((existingThreadIds ?? []).map((r) => r.thread_id));

  let filled = 0, inserted = 0;
  for (const t of threads) {
    const { data: participants } = await db.from("chat_participants").select("user_id, role_in_thread").eq("thread_id", t.id);
    const curator = (participants ?? []).find((p) => p.role_in_thread === "curator");
    const studentUserIds = (participants ?? []).filter((p) => p.role_in_thread === "student").map((p) => p.user_id);
    if (!curator || studentUserIds.length === 0) { console.log(`  [пропуск] тред ${t.id} — не ученический (${participants?.length ?? 0} участников, ролей student нет)`); continue; }
    if (populated.has(t.id)) { console.log(`  [${t.title}] → ПРОПУСК (уже есть сообщения)`); continue; }

    const { data: subjects } = await db.from("subjects").select("teacher:teachers(user_id)").eq("group_id", t.group_id).eq("is_active", true);
    const teacherUserIds = (subjects ?? []).map((s) => s.teacher?.user_id).filter(Boolean);

    const msgCount = randomInt(20, 30);
    const stamps = [...Array(msgCount)].map(() => randomTimeBetween(twoWeeksAgoIso(), nowIso())).sort();
    const rows = [];
    for (let i = 0; i < msgCount; i++) {
      const r = Math.random();
      let senderId, body;
      if (r < 0.20) { senderId = curator.user_id; body = pick(CURATOR_LINES); }
      else if (r < 0.35 && teacherUserIds.length > 0) { senderId = pick(teacherUserIds); body = pick(TEACHER_LINES); }
      else { senderId = pick(studentUserIds); body = pick(STUDENT_LINES); }
      rows.push({ thread_id: t.id, sender_id: senderId, body, created_at: stamps[i], school_id: t.school_id ?? SCHOOL_ID });
    }
    const { error: insErr } = await db.from("chat_messages").insert(rows);
    if (insErr) { console.error(`  !! group thread "${t.title}" insert failed: ${insErr.message}`); continue; }
    console.log(`  [${t.title}] → OK (${rows.length} сообщений)`);
    filled++; inserted += rows.length;
  }
  console.log(`Групповые чаты: заполнено тредов ${filled}, сообщений вставлено ${inserted}.\n`);
  return inserted;
}

// ═══════════════════════════ ЧАСТЬ A.2 — DIRECT ЧАТЫ ═══════════════════════
function activeDialog1() {
  return [
    { role: "student", body: "Здравствуйте, не могу понять задачу 3, помогите" },
    { role: "teacher", body: "Обрати внимание на пример из третьего этапа" },
    { role: "student", body: "Спасибо, понял!" },
    { role: "teacher", body: "Отличная работа с ДЗ, продолжай в том же духе" },
    { role: "student", body: "Спасибо большое" },
  ];
}
function activeDialog2() {
  return [
    { role: "student", body: "Здравствуйте, у меня вопрос по домашнему заданию" },
    { role: "teacher", body: "Слушаю, что именно непонятно?" },
    { role: "student", body: "Не получается одно из заданий" },
    { role: "teacher", body: "Посмотри пример в материалах урока, там разобран похожий случай" },
    { role: "student", body: "А, теперь понял, спасибо!" },
    { role: "teacher", body: "Отлично! Если ещё будут вопросы — пиши" },
    { role: "student", body: "Хорошо, спасибо большое" },
    { role: "teacher", body: "Удачи с остальными заданиями" },
  ];
}
function activeDialog3() {
  return [
    { role: "teacher", body: "Здравствуйте! Хочу напомнить про завтрашний тест" },
    { role: "student", body: "Здравствуйте, спасибо за напоминание" },
    { role: "student", body: "А что нужно повторить?" },
    { role: "teacher", body: "Повтори темы из последних трёх уроков" },
    { role: "student", body: "Хорошо, повторю" },
    { role: "teacher", body: "Удачи на тесте!" },
  ];
}
function inactiveDialog1() {
  return [{ role: "teacher", body: "Здравствуйте, вопросы по уроку — пишите" }];
}
function inactiveDialog2() {
  return [
    { role: "student", body: "Здравствуйте" },
    { role: "teacher", body: "Привет!" },
  ];
}
function inactiveDialog3() {
  return [{ role: "teacher", body: "Добрый день! Готов(а) помочь, если будут вопросы." }];
}

async function fillDirectThreads() {
  const { data: threads, error } = await db.from("chat_threads").select("id, student_id, teacher_id, school_id").eq("school_id", SCHOOL_ID).eq("kind", "direct");
  if (error) fail(`Ошибка запроса direct chat_threads: ${error.message}`);
  console.log(`Direct-тредов: ${threads.length} (ожидание 180).`);

  const { data: existingThreadIds } = await db.from("chat_messages").select("thread_id").in("thread_id", threads.map((t) => t.id));
  const populated = new Set((existingThreadIds ?? []).map((r) => r.thread_id));
  const pending = threads.filter((t) => !populated.has(t.id));
  console.log(`Уже заполнено: ${threads.length - pending.length}. К заполнению: ${pending.length}.`);

  const shuffled = shuffle(pending);
  const activeThreads = new Set(shuffled.slice(0, 50).map((t) => t.id));

  const studentIds = [...new Set(threads.map((t) => t.student_id))];
  const teacherIds = [...new Set(threads.map((t) => t.teacher_id))];
  const { data: studentsRaw } = await db.from("students").select("id, user_id").in("id", studentIds);
  const { data: teachersRaw } = await db.from("teachers").select("id, user_id").in("id", teacherIds);
  const studentUserById = new Map(studentsRaw.map((s) => [s.id, s.user_id]));
  const teacherUserById = new Map(teachersRaw.map((t) => [t.id, t.user_id]));

  let activeFilled = 0, inactiveFilled = 0, totalInserted = 0;
  for (const t of pending) {
    const studentUserId = studentUserById.get(t.student_id);
    const teacherUserId = teacherUserById.get(t.teacher_id);
    if (!studentUserId || !teacherUserId) { console.error(`  !! direct thread ${t.id}: не резолвится student/teacher user_id`); continue; }

    const isActive = activeThreads.has(t.id);
    const dialog = isActive ? pick([activeDialog1, activeDialog2, activeDialog3])() : pick([inactiveDialog1, inactiveDialog2, inactiveDialog3])();
    const stamps = [...Array(dialog.length)].map(() => randomTimeBetween(twoWeeksAgoIso(), nowIso())).sort();
    const rows = dialog.map((m, i) => ({
      thread_id: t.id,
      sender_id: m.role === "teacher" ? teacherUserId : studentUserId,
      body: m.body,
      created_at: stamps[i],
      school_id: t.school_id ?? SCHOOL_ID,
    }));
    const { error: insErr } = await db.from("chat_messages").insert(rows);
    if (insErr) { console.error(`  !! direct thread ${t.id} insert failed: ${insErr.message}`); continue; }
    totalInserted += rows.length;
    if (isActive) activeFilled++; else inactiveFilled++;
  }
  console.log(`Direct чаты: активных заполнено ${activeFilled} (ожидание ~50), неактивных ${inactiveFilled} (ожидание ~130). Сообщений вставлено: ${totalInserted}.\n`);
  return totalInserted;
}

// ═══════════════════════════ ЧАСТЬ B — ОБЪЯВЛЕНИЯ ══════════════════════════
const SCHOOL_ANNOUNCEMENTS = [
  { title: "Родительское собрание", body: "Уважаемые родители, 5 августа в 18:00 состоится общешкольное родительское собрание. Просим присутствовать." },
  { title: "Спортивный день", body: "1 августа в школе пройдёт день спорта. Ученики 3-10 классов участвуют в соревнованиях." },
  { title: "Экскурсия в музей", body: "Организуется поездка в исторический музей 4 августа. Стоимость 30 000 сум, запись у классного руководителя." },
  { title: "Расписание летних каникул", body: "Летние каникулы с 10 августа по 30 августа. Занятия возобновятся 1 сентября." },
  { title: "Приём в 1 класс", body: "Продолжается набор учеников в 1 класс на 2026-2027 учебный год. Документы у секретаря." },
];
const CLASS_ANNOUNCEMENTS = {
  "3-А класс": [
    { title: "Контрольная по математике", body: "3-А класс, 31 июля контрольная работа по математике. Готовимся!" },
    { title: "Творческий вечер", body: "3-А, приглашаем на творческий вечер в пятницу" },
  ],
  "7-А класс": [
    { title: "Экзамен по программированию", body: "7-А, 1 августа тестирование по программированию" },
    { title: "Дежурство", body: "7-А, на следующей неделе дежурит наш класс" },
  ],
  "10-А класс": [
    { title: "Пробный ЕГЭ", body: "10-А, 2 августа пробный ЕГЭ по математике" },
    { title: "Профориентация", body: "10-А, встреча с представителями вузов Ташкента" },
  ],
};

async function fillAnnouncements() {
  const { data: existing } = await db.from("announcements").select("title").eq("school_id", SCHOOL_ID);
  const existingTitles = new Set((existing ?? []).map((r) => r.title));

  const { data: admin, error: aErr } = await db.from("admins").select("id").eq("school_id", SCHOOL_ID).limit(1).maybeSingle();
  if (aErr) fail(`Ошибка запроса admins: ${aErr.message}`);
  if (!admin) fail("Не найден ни один admin для демо-школы — нужен для scope='all_my_groups' общешкольных объявлений.");

  const { data: groups, error: gErr } = await db.from("groups").select("id, name, teacher_id").eq("school_id", SCHOOL_ID);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);

  const rows = [];
  for (const a of SCHOOL_ANNOUNCEMENTS) {
    if (existingTitles.has(a.title)) { console.log(`  [школа] "${a.title}" → ПРОПУСК (уже есть)`); continue; }
    rows.push({
      school_id: SCHOOL_ID, scope: "all_my_groups", admin_id: admin.id, created_by: null,
      group_id: null, target_student_id: null, title: a.title, body: a.body,
      is_pinned: false, category: "general", is_ticker: false,
      created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
    });
  }
  for (const group of groups) {
    for (const a of CLASS_ANNOUNCEMENTS[group.name] ?? []) {
      if (existingTitles.has(a.title)) { console.log(`  [${group.name}] "${a.title}" → ПРОПУСК (уже есть)`); continue; }
      rows.push({
        school_id: SCHOOL_ID, scope: "group", admin_id: null, created_by: group.teacher_id,
        group_id: group.id, target_student_id: null, title: a.title, body: a.body,
        is_pinned: false, category: "academic", is_ticker: false,
        created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
      });
    }
  }

  if (rows.length === 0) { console.log("Объявления: нечего вставлять (все уже есть).\n"); return 0; }
  const { error: insErr } = await db.from("announcements").insert(rows);
  if (insErr) fail(`Ошибка вставки announcements: ${insErr.message}`);
  console.log(`Объявления: вставлено ${rows.length} (школьных ${rows.filter((r) => r.scope === "all_my_groups").length}, классных ${rows.filter((r) => r.scope === "group").length}).\n`);
  return rows.length;
}

// ═══════════════════════════ ЧАСТЬ C — УВЕДОМЛЕНИЯ (посещаемость родителям) ══
const PARENT_ATTENDANCE_TEMPLATES = [
  (childName) => ({ title: "Посещаемость", body: `${childName} — пропуск урока по уважительной причине.` }),
  (childName) => ({ title: "Посещаемость", body: `Отчёт по посещаемости: ${childName} регулярно посещает занятия.` }),
];

async function fillParentAttendanceNotifications() {
  const { data: parents, error: pErr } = await db
    .from("parents")
    .select("id, user_id, full_name, parent_students(student_id, student:students(full_name))")
    .eq("school_id", SCHOOL_ID);
  if (pErr) fail(`Ошибка запроса parents: ${pErr.message}`);
  console.log(`Родителей найдено: ${parents.length}.`);

  const { data: existing } = await db.from("notifications").select("recipient_user_id").eq("school_id", SCHOOL_ID).eq("kind", "student_excused");
  const alreadyNotified = new Map();
  for (const r of existing ?? []) alreadyNotified.set(r.recipient_user_id, (alreadyNotified.get(r.recipient_user_id) ?? 0) + 1);

  const rows = [];
  for (const parent of parents) {
    const already = alreadyNotified.get(parent.user_id) ?? 0;
    if (already > 0) { console.log(`  [${parent.full_name}] → ПРОПУСК (уже есть ${already} уведомлений о посещаемости)`); continue; }
    const children = parent.parent_students ?? [];
    const count = Math.min(2, Math.max(1, children.length));
    for (let i = 0; i < count; i++) {
      const child = children[i % children.length];
      const childName = child.student?.full_name ?? "ребёнок";
      const template = pick(PARENT_ATTENDANCE_TEMPLATES)(childName);
      rows.push({
        recipient_user_id: parent.user_id, kind: "student_excused",
        title: template.title, body: template.body, link: "/parent/progress",
        source_id: null, school_id: SCHOOL_ID,
        created_at: randomTimeBetween(twoWeeksAgoIso(), nowIso()),
      });
    }
  }
  if (rows.length === 0) { console.log("Уведомления о посещаемости: нечего вставлять.\n"); return 0; }
  const { error: insErr } = await db.from("notifications").insert(rows);
  if (insErr) fail(`Ошибка вставки notifications: ${insErr.message}`);
  console.log(`Уведомления о посещаемости: вставлено ${rows.length} для ${new Set(rows.map((r) => r.recipient_user_id)).size} родителей.\n`);
  return rows.length;
}

async function main() {
  console.log(`Чаты + объявления + уведомления — демо-школа (${SCHOOL_ID})\n`);
  console.log("=== ЧАСТЬ A.1: групповые чаты ===");
  const groupMsgs = await fillGroupThreads();
  console.log("=== ЧАСТЬ A.2: direct чаты ===");
  const directMsgs = await fillDirectThreads();
  console.log("=== ЧАСТЬ B: объявления ===");
  const announcementsInserted = await fillAnnouncements();
  console.log("=== ЧАСТЬ C: уведомления (посещаемость родителям) ===");
  const notificationsInserted = await fillParentAttendanceNotifications();

  console.log(`\nГотово: chat_messages +${groupMsgs + directMsgs} (группа ${groupMsgs} + direct ${directMsgs}), announcements +${announcementsInserted}, notifications(student_excused) +${notificationsInserted}.`);

  // ── финальная проверка ──
  const { count: cmTotal } = await db.from("chat_messages").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { count: annTotal } = await db.from("announcements").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  const { data: notifByKind } = await db.from("notifications").select("kind").eq("school_id", SCHOOL_ID);
  const kindCounts = {};
  for (const r of notifByKind ?? []) kindCounts[r.kind] = (kindCounts[r.kind] ?? 0) + 1;

  console.log(`\nПроверка: chat_messages всего — ${cmTotal} (ожидание 500-800).`);
  console.log(`announcements всего — ${annTotal} (ожидание 11).`);
  console.log(`notifications всего — ${notifByKind?.length ?? 0}, по kind: ${JSON.stringify(kindCounts)}.`);
  console.log(`  (announcement/announcement_new — авто из триггера fn_announce_notify на INSERT в announcements, не создавались вручную)`);
}

main().catch((e) => fail(e.stack ?? String(e)));
