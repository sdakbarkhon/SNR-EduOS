#!/usr/bin/env node
// 09.08.2026 — три учебных плана демо-школы затёрты оглавлением загруженной
// книги по Python. Восстановление исходных тем и ссылок у уроков.
//
// ЧТО СЛУЧИЛОСЬ. Учитель загрузил PDF книги в разделе учебных планов, выбрав
// пару группа+предмет, у которой план уже был, и подтвердил «Заменить».
// Дальше отработал штатный путь: apps/web/app/api/curriculum-plans/
// create-processing → replaceCurriculumPlanProcessing (packages/core/src/
// queries/curriculum.ts) УДАЛЯЕТ старый план, CASCADE уносит его темы, а
// lessons.curriculum_topic_id обнуляется через ON DELETE SET NULL. Затем
// фоновый разбор пишет в новый план оглавление файла. Это не поломка —
// механизм делает ровно то, что обещает диалогом. Здесь он НЕ чинится.
//
// Пострадали три пары, все три заменены в окне 05-08.08 — том самом, что
// заказчик признал ручными проверками и распорядился вычистить:
//   06.08 11:33  Rustam Rakhmatov  → 10-А программирование
//   07.08 07:11  Kamila Yusupova   → 3-А робототехника
//   07.08 15:28  Rustam Rakhmatov  → 3-А программирование
// В двух первых по времени случаях (3-А) легло оглавление учебника Python,
// причём в робототехнику — чужой предмет целиком. В 10-А программировании
// лежит другое: связный курс по Minecraft на 24 темы. Предмет он не путает,
// но для десятого класса это курс для младших (эталон там — ООП, C++,
// сортировки), и создан он внутри мусорного окна, поэтому восстанавливается
// наравне с остальными. Остальные двенадцать планов целы, их скрипт не
// касается.
//
// Заменяемые темы перед удалением выгружаются в
// scripts/.replaced-curriculum-topics.json — чтобы ничего не пропало
// безвозвратно, если окажется, что какой-то из курсов был нужен.
//
// ИСТОЧНИК ТЕМ — константа TOPICS из create-curriculum-plans-week.mjs, тем же
// списком названы все уроки недели и им же пользовался
// restore-demo-lessons.mjs.
//
// УРОКОВ БЕЗ ССЫЛКИ 25, а не 22: три из них созданы 09.08 при восстановлении
// после аварии ночного отката — они относятся к тем же трём парам и ссылки
// тоже не имели, потому что в плане не было подходящей темы.
//
// ЧТО НЕ ТРОГАЕТСЯ: уроки (кроме единственного поля curriculum_topic_id),
// этапы, материалы, снимок эталона (curriculum_plan_topics в него не входит,
// а проставление ссылки — UPDATE, состав снимка не меняет).
//
// ЗАПУСК (из apps/web):
//   node scripts/fix-demo-curriculum-plans.mjs           # холостой прогон
//   node scripts/fix-demo-curriculum-plans.mjs --apply   # запись

import fs from "node:fs";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const D = SCHOOL_ID;
const APPLY = process.argv.includes("--apply");
const WEEK_LABEL = "27.07–02.08";
const BACKUP_PATH = new URL("./.replaced-curriculum-topics.json", import.meta.url);

const fail = (msg) => { console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`); process.exit(1); };

/** Повтор при обрыве сети. За день соединение с Supabase рвалось дважды
 *  (TypeError: fetch failed) прямо посреди записи, оставляя работу
 *  наполовину сделанной. Скрипт и так идемпотентен, но лучше не падать. */
async function withRetry(label, fn) {
  const backoff = [1000, 3000, 8000];
  for (let attempt = 0; ; attempt++) {
    // Билдер supabase-js — thenable, но не Promise: .catch() у него нет до
    // await, поэтому обрабатываем через try/catch, а не через .catch().
    let res;
    try {
      res = await fn();
    } catch (e) {
      res = { error: e };
    }
    if (!res?.error) return res;
    const msg = res.error.message ?? String(res.error);
    if (attempt >= backoff.length) fail(`${label}: ${msg}`);
    console.warn(`   сбой (${label}), попытка ${attempt + 2}: ${msg.slice(0, 60)}`);
    await new Promise((r) => setTimeout(r, backoff[attempt]));
  }
}

/** TOPICS из create-curriculum-plans-week.mjs, дословно. Здесь нужны все
 *  пять предметов, а не только три пострадавшие пары: по ним проверяется,
 *  что тема не принадлежит чужому предмету. */
const TOPICS = {
  "Математика": {
    "3-А класс": ["Сложение чисел в пределах 100", "Вычитание с переходом через десяток", "Задачи на сложение и вычитание", "Умножение как повторное сложение", "Таблица умножения на 2 и 3", "Простые задачи на умножение", "Единицы измерения длины"],
    "7-А класс": ["Обыкновенные дроби: сложение и вычитание", "Умножение и деление дробей", "Десятичные дроби и их сравнение", "Проценты: нахождение процента от числа", "Проценты в жизненных задачах", "Линейные уравнения с одной переменной", "Решение задач с помощью уравнений"],
    "10-А класс": ["Понятие производной функции", "Производные элементарных функций", "Применение производной: экстремумы функции", "Первообразная и неопределённый интеграл", "Определённый интеграл и площадь фигуры", "Тригонометрические функции и их графики", "Тригонометрические уравнения"],
  },
  "Программирование": {
    "3-А класс": ["Знакомство со Scratch: спрайты и сцена", "Простые скрипты в Scratch: движение персонажа", "Циклы в Scratch: повторение действий", "Введение в Python: команда print", "Переменные в Python: числа и слова", "Простые вычисления в Python", "Ввод данных с клавиатуры (input)"],
    "7-А класс": ["Функции в Python: def и return", "Параметры функций", "Циклы for и while", "Списки: создание и обращение к элементам", "Методы списков: append, sort", "Условные конструкции if/elif/else", "Мини-проект: программа-калькулятор"],
    "10-А класс": ["Введение в ООП. Классы и объекты", "Наследование и полиморфизм", "Инкапсуляция и абстракция", "Работа с файлами в Python", "Введение в C++. Синтаксис", "Указатели и ссылки в C++", "Основы алгоритмов сортировки"],
  },
  "Робототехника": {
    "3-А класс": ["Что такое робототехника: простые механизмы", "Знакомство с платой Arduino", "Первая схема: подключение светодиода", "Управление светодиодом через Wokwi", "Мигающий светодиод: программа для Arduino", "Кнопка как источник сигнала", "Простой проект: светофор на светодиодах"],
    "7-А класс": ["Датчики температуры: подключение и считывание", "Датчик освещённости на Arduino", "Работа с ЖК-дисплеем", "Управление сервоприводом", "Датчик расстояния (ультразвуковой)", "Проект «Умный дом»: датчики + реле", "Отладка и тестирование схемы в Wokwi"],
    "10-А класс": ["Архитектура автономных систем", "Датчики движения и их калибровка", "Алгоритмы обхода препятствий", "Обратная связь и ПИД-регулирование (базово)", "Проектирование робота-манипулятора", "Связь между модулями (I2C/SPI, обзорно)", "Итоговый проект: автономный робот"],
  },
  "Английский язык": {
    "3-А класс": ["Английский алфавит", "Приветствия и знакомство", "Цвета вокруг нас", "Моя семья", "Числа от 1 до 20", "Животные и их названия", "Дни недели"],
    "7-А класс": ["Present Simple: утверждения и вопросы", "Present Continuous: действия сейчас", "Past Simple: правильные и неправильные глаголы", "Future Simple: планы на будущее", "Разговорная практика: рассказ о себе", "Чтение и обсуждение короткого текста", "Повторение времён: сравнение Present/Past/Future"],
    "10-А класс": ["Present Perfect vs Past Simple", "Условные предложения (Conditionals)", "Модальные глаголы для продвинутого уровня", "Структура эссе: introduction, body, conclusion", "Написание эссе-рассуждения (opinion essay)", "Знакомство с английской литературой: отрывок из классики", "Анализ художественного текста"],
  },
  "Русский язык": {
    "3-А класс": ["Имя существительное: что называет предмет", "Имя прилагательное: признак предмета", "Глагол: что делает предмет", "Простое предложение: подлежащее и сказуемое", "Заглавная буква в начале предложения", "Правописание безударных гласных", "Составление рассказа по картинке"],
    "7-А класс": ["Словосочетание и предложение", "Главные и второстепенные члены предложения", "Простое осложнённое предложение (однородные члены)", "Сложносочинённое предложение", "Сложноподчинённое предложение", "Пунктуация при однородных членах", "Знаки препинания в сложном предложении"],
    "10-А класс": ["Функциональные стили речи", "Художественный стиль: средства выразительности", "Анализ лирического произведения", "Анализ эпического произведения", "Сочинение-рассуждение по тексту", "Литературная критика: структура рецензии", "Практикум: написание рецензии"],
  },
};

/** Следы оглавления книги, а не учебного плана. Служат опознанием
 *  испорченного плана и проверкой, что после починки их не осталось. */
const BOOK_MARKERS = /Предметный указатель|Установка |Файлы примеров|Ответы на вопросы|Решение распространенных проблем/i;

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

const { data: groups, error: gErr } = await db.from("groups").select("id, name").eq("school_id", D);
if (gErr) fail(`чтение групп: ${gErr.message}`);
const gName = new Map(groups.map((g) => [g.id, g.name]));

const { data: subjects, error: sErr } = await db.from("subjects").select("id, name, teacher_id");
if (sErr) fail(`чтение предметов: ${sErr.message}`);
const sName = new Map(subjects.map((s) => [s.id, s.name]));

const { data: plans, error: pErr } = await db.from("curriculum_plans").select("*").eq("school_id", D);
if (pErr) fail(`чтение планов: ${pErr.message}`);
if (plans.length !== 15) fail(`планов ${plans.length}, ожидалось 15`);

const { data: allTopics, error: tErr } = await db
  .from("curriculum_plan_topics").select("id, plan_id, order_index, title").in("plan_id", plans.map((p) => p.id));
if (tErr) fail(`чтение тем: ${tErr.message}`);
const topicsOf = (planId) => allTopics.filter((t) => t.plan_id === planId).sort((a, b) => a.order_index - b.order_index);

// ── опознание испорченных ───────────────────────────────────────────────────
// Признак не «24 темы», а расхождение с эталонным списком: план считается
// испорченным, если его темы не совпадают с TOPICS своей пары.
const broken = [];
const intact = [];
for (const p of plans) {
  const subj = sName.get(p.subject_id);
  const grp = gName.get(p.group_id);
  const want = TOPICS[subj]?.[grp];
  if (!want) fail(`нет эталонного списка тем для пары ${grp} · ${subj}`);
  const have = topicsOf(p.id).map((t) => t.title);
  const same = have.length === want.length && have.every((t, i) => t === want[i]);
  (same ? intact : broken).push({ plan: p, subj, grp, want, have });
}

// Испорченных ожидается три, но скрипт обязан переживать повтор после
// обрыва: если часть планов уже починена, их просто не окажется в списке.
// Больше трёх — состояние не то, о котором задача, и это стоп.
console.log(`Планов целых: ${intact.length}, испорченных: ${broken.length}`);
if (broken.length > 3) fail(`испорченных планов ${broken.length}, ожидалось не больше 3 — состояние не то, что в задаче`);
if (broken.length === 0) console.log("Планы уже в порядке — останется только проставить недостающие ссылки.");

console.log("\n── ЧТО БУДЕТ ИСПРАВЛЕНО ──");
for (const b of broken) {
  const title = `${b.subj} — ${b.grp}, неделя ${WEEK_LABEL}`;
  console.log(`\n${b.grp} · ${b.subj}`);
  console.log(`   тем сейчас ${b.have.length}, из них похожих на оглавление книги: ${b.have.filter((t) => BOOK_MARKERS.test(t)).length}`);
  console.log(`   примеры лишнего: ${b.have.filter((t) => BOOK_MARKERS.test(t)).slice(0, 3).join(" | ") || "—"}`);
  console.log(`   станет ${b.want.length} тем: ${b.want.slice(0, 3).join(" | ")} …`);
  console.log(`   заголовок: «${b.plan.title}» → «${title}»`);
  console.log(`   ссылка на файл книги (${b.plan.source_file_type}) будет снята — у двенадцати целых планов её нет`);
}

// ── уроки без ссылки ────────────────────────────────────────────────────────
// Берём ВСЕ уроки недели без ссылки, а не только уроки испорченных пар: после
// обрыва посреди прогона часть планов уже починена, а их уроки ссылок ещё не
// получили — такие обязаны подхватиться при повторе.
const { data: lessons, error: lErr } = await db
  .from("lessons").select("id, title, group_id, subject_id, curriculum_topic_id, starts_at")
  .eq("school_id", D)
  .gte("starts_at", "2026-07-27T00:00:00+05:00").lt("starts_at", "2026-08-03T00:00:00+05:00")
  .order("starts_at");
if (lErr) fail(`чтение уроков: ${lErr.message}`);

const unlinked = lessons.filter((l) => !l.curriculum_topic_id);
/** Название темы, положенной уроку по эталонному списку его пары. */
const wantedFor = (l) => TOPICS[sName.get(l.subject_id)]?.[gName.get(l.group_id)] ?? [];
const unmatched = unlinked.filter((l) => !wantedFor(l).includes(l.title));
const toLink = unlinked.filter((l) => wantedFor(l).includes(l.title));

console.log("\n── УРОКИ БЕЗ ССЫЛКИ НА ТЕМУ ──");
const pairs = [...new Set(unlinked.map((l) => `${gName.get(l.group_id)} · ${sName.get(l.subject_id)}`))];
console.table(pairs.map((pair) => {
  const mine = unlinked.filter((l) => `${gName.get(l.group_id)} · ${sName.get(l.subject_id)}` === pair);
  return { пара: pair, без_ссылки: mine.length, тема_найдётся: mine.filter((l) => wantedFor(l).includes(l.title)).length };
}));
if (unmatched.length) {
  console.log(`\nУроков, которым тема не найдётся по названию: ${unmatched.length}`);
  for (const l of unmatched) console.log(`   «${l.title}» (${gName.get(l.group_id)} · ${sName.get(l.subject_id)})`);
  console.log("   Такие остаются без ссылки — угадывать тему не будем.");
}

console.log(`\nИтого: заменить темы в ${broken.length} планах (${broken.reduce((a, b) => a + b.have.length, 0)} → ${broken.length * 7}), проставить ссылок ${toLink.length}`);

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply применит изменения.");
  process.exit(0);
}

// ── запись ──────────────────────────────────────────────────────────────────
// Выгрузка заменяемого — до первого удаления. Дописываем к уже сохранённому,
// а не перезаписываем: при повторе после обрыва испорченных планов остаётся
// меньше, и простая перезапись стёрла бы выгрузку предыдущего прогона.
if (broken.length) {
  const prev = fs.existsSync(BACKUP_PATH) ? JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8")) : [];
  const fresh = broken.map((b) => ({
    группа: b.grp, предмет: b.subj, план: b.plan.title,
    создан: b.plan.created_at, файл: b.plan.source_file_url,
    темы: topicsOf(b.plan.id).map((t) => ({ order_index: t.order_index, title: t.title })),
  }));
  const merged = [...prev.filter((p) => !fresh.some((f) => f.группа === p.группа && f.предмет === p.предмет)), ...fresh];
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(merged, null, 1));
  console.log(`\nЗаменяемые темы сохранены (${merged.length} планов): scripts/.replaced-curriculum-topics.json`);
}

const intactIds = new Set(intact.map((i) => i.plan.id));
let topicsDeleted = 0, topicsInserted = 0, linksSet = 0;

// ── 1. темы испорченных планов ──────────────────────────────────────────────
for (const b of broken) {
  if (intactIds.has(b.plan.id)) fail("попытка тронуть целый план — остановка");

  const old = topicsOf(b.plan.id).map((t) => t.id);
  await withRetry(`удаление тем ${b.grp} · ${b.subj}`,
    () => db.from("curriculum_plan_topics").delete().in("id", old));
  topicsDeleted += old.length;

  const inserted = await withRetry(`вставка тем ${b.grp} · ${b.subj}`, () =>
    db.from("curriculum_plan_topics").insert(
      b.want.map((title, i) => ({ plan_id: b.plan.id, order_index: i, title, description: null, estimated_lessons: 1 })),
    ).select("id, title"));
  topicsInserted += inserted.data.length;

  await withRetry(`обновление плана ${b.grp} · ${b.subj}`, () =>
    db.from("curriculum_plans").update({
      title: `${b.subj} — ${b.grp}, неделя ${WEEK_LABEL}`,
      source_file_url: null, source_file_type: null,
      status: "ready", progress_percent: 100, error_message: null,
    }).eq("id", b.plan.id));

  console.log(`   ${b.grp} · ${b.subj}: ${old.length} → ${inserted.data.length} тем, файл снят`);
}

// ── 2. ссылки уроков ────────────────────────────────────────────────────────
// Отдельной фазой, по свежим темам: так уроки уже починенных планов
// подхватываются при повторе после обрыва.
const { data: freshTopics, error: ftErr } = await db
  .from("curriculum_plan_topics").select("id, plan_id, title").in("plan_id", plans.map((p) => p.id));
if (ftErr) fail(`перечитывание тем: ${ftErr.message}`);
const topicIdFor = new Map();
for (const t of freshTopics) {
  const p = plans.find((x) => x.id === t.plan_id);
  topicIdFor.set(`${p.group_id}|${p.subject_id}|${t.title}`, t.id);
}

for (const l of toLink) {
  const topicId = topicIdFor.get(`${l.group_id}|${l.subject_id}|${l.title}`);
  if (!topicId) { console.warn(`   тема не нашлась для «${l.title}» — пропуск`); continue; }
  await withRetry(`ссылка урока «${l.title}»`,
    () => db.from("lessons").update({ curriculum_topic_id: topicId }).eq("id", l.id));
  linksSet++;
}

console.log(`\nУдалено тем: ${topicsDeleted}; вставлено: ${topicsInserted}; проставлено ссылок: ${linksSet}`);

// ── проверка после записи ───────────────────────────────────────────────────
const { data: plansAfter } = await db.from("curriculum_plans").select("*").eq("school_id", D);
const { data: topicsAfter } = await db
  .from("curriculum_plan_topics").select("id, plan_id, order_index, title").in("plan_id", plansAfter.map((p) => p.id));

const problems = [];
for (const p of plansAfter) {
  const subj = sName.get(p.subject_id), grp = gName.get(p.group_id);
  const have = topicsAfter.filter((t) => t.plan_id === p.id).sort((a, b) => a.order_index - b.order_index).map((t) => t.title);
  const want = TOPICS[subj][grp];
  if (have.length !== 7) problems.push(`${grp} · ${subj}: тем ${have.length}, а не 7`);
  if (!have.every((t, i) => t === want[i])) problems.push(`${grp} · ${subj}: темы не совпадают с эталоном`);
  const foreign = have.filter((t) => !want.includes(t));
  if (foreign.length) problems.push(`${grp} · ${subj}: чужие темы — ${foreign.slice(0, 2).join(", ")}`);
  if (have.some((t) => BOOK_MARKERS.test(t))) problems.push(`${grp} · ${subj}: остались следы оглавления книги`);
}

// робототехника не должна содержать ни одной темы про Python
const roboPython = topicsAfter.filter((t) => {
  const p = plansAfter.find((x) => x.id === t.plan_id);
  return sName.get(p?.subject_id) === "Робототехника" && /python|pygame|tkinter/i.test(t.title);
});
if (roboPython.length) problems.push(`в робототехнике ${roboPython.length} тем про Python: ${roboPython.slice(0, 3).map((t) => t.title).join(", ")}`);

console.log("\n── ПРОВЕРКА ──");
console.log(`Планов: ${plansAfter.length}; у всех по 7 тем: ${plansAfter.every((p) => topicsAfter.filter((t) => t.plan_id === p.id).length === 7)}`);
console.log(`Тем всего: ${topicsAfter.length} (ожидание 105 = 15 × 7)`);
console.log(`Тем про Python в робототехнике: ${roboPython.length} (ожидание 0)`);
console.log(`Планов со ссылкой на файл: ${plansAfter.filter((p) => p.source_file_url).length} (ожидание 0)`);

const { data: lessonsAfter } = await db
  .from("lessons").select("id, title, group_id, subject_id, curriculum_topic_id").eq("school_id", D)
  .gte("starts_at", "2026-07-27T00:00:00+05:00").lt("starts_at", "2026-08-03T00:00:00+05:00");
const affectedAfter = lessonsAfter;
console.log(`Уроков недели: ${affectedAfter.length}; со ссылкой: ${affectedAfter.filter((l) => l.curriculum_topic_id).length}; без: ${affectedAfter.filter((l) => !l.curriculum_topic_id).length}`);

// ссылка обязана вести на тему своего плана и совпадать по названию
const topicById = new Map(topicsAfter.map((t) => [t.id, t]));
const mismatched = affectedAfter.filter((l) => {
  if (!l.curriculum_topic_id) return false;
  const t = topicById.get(l.curriculum_topic_id);
  if (!t) return true;
  const p = plansAfter.find((x) => x.id === t.plan_id);
  return p?.group_id !== l.group_id || p?.subject_id !== l.subject_id || t.title !== l.title;
});
if (mismatched.length) problems.push(`${mismatched.length} уроков ссылаются на чужую или несовпадающую тему`);
console.log(`Уроков со ссылкой не на свою тему: ${mismatched.length} (ожидание 0)`);

// двенадцать целых планов не должны были измениться
for (const i of intact) {
  const p = plansAfter.find((x) => x.id === i.plan.id);
  if (!p) { problems.push(`целый план ${i.grp} · ${i.subj} исчез`); continue; }
  if (p.title !== i.plan.title || p.source_file_url !== i.plan.source_file_url) {
    problems.push(`целый план ${i.grp} · ${i.subj} изменён`);
  }
}
console.log(`Двенадцать целых планов не тронуты: ${problems.every((x) => !/целый план/.test(x))}`);

if (problems.length) { console.log("\nНЕ СОШЛОСЬ:"); for (const p of problems) console.log("   ", p); fail(`${problems.length} проблем`); }
console.log("\nГОТОВО. Все проверки пройдены.");
