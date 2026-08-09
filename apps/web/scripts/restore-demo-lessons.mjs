#!/usr/bin/env node
// 09.08.2026 — ВОССТАНОВЛЕНИЕ. Шаг 1: создание уроков, снесённых аварией
// ночного отката 08.08 (разбор в restore-demo-shape.ts).
//
// Из 126 уроков эталонной недели 27.07-02.08 уцелело 77. Скрипт создаёт
// недостающие 49 по плану scripts/.tmp-plan.json (предмет × группа × слот,
// без новых пересечений учителей).
//
// ТЕМЫ берутся из списка ниже — это TOPICS из create-curriculum-plans-week.mjs,
// того самого скрипта, которым неделя создавалась изначально.
//
// Почему не из таблицы curriculum_plan_topics, где эти темы и лежат. Три плана
// из пятнадцати позже затёрли оглавлением загруженной книги: 3-А Робототехника
// и 3-А Программирование получили по 24 «темы» из учебника Python (включая
// «Установка Pygame (вариант 2)» и «Предметный указатель»), 10-А
// Программирование — тоже 24. В робототехнику при этом попал ЧУЖОЙ предмет.
// Проверяется однозначно: 22 уцелевших урока без curriculum_topic_id — это
// ровно эти три пары (6+9+7), ссылки оборвались при затирании планов.
// Уцелевшие уроки 3-А робототехники называются «Мигающий светодиод»,
// «Кнопка как источник сигнала» — то есть по списку ниже, а не по книге.
//
// Сначала расходуются темы, не занятые уцелевшими уроками этой пары
// предмет×группа; когда свободные кончаются, темы повторяются по порядку —
// ровно так же, как в уцелевшем эталоне (там повторы уже есть).
//
// curriculum_topic_id проставляется, только если в плане нашлась тема с таким
// же названием. Для трёх испорченных пар совпадения не будет — и новые уроки
// останутся без ссылки, как их уцелевшие соседи. Чинить сами планы — отдельная
// задача, здесь мы их не трогаем.
//
// Статус всем ставится scheduled: форма урока (завершён / идёт / ждёт)
// наводится отдельным шагом, после наполнения.
//
// ОТМЕНА. Идентификаторы созданного пишутся в scripts/.restored-lessons.json,
// так что откатить можно точно эти строки и никакие другие. Транзакции нет:
// прямое подключение к Postgres недоступно, работаем через PostgREST —
// поэтому проверки идут и до, и после записи.
//
// ЗАПУСК (из apps/web):
//   node scripts/restore-demo-lessons.mjs           # холостой прогон
//   node scripts/restore-demo-lessons.mjs --apply   # запись

import fs from "node:fs";
import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();
const D = SCHOOL_ID;
const APPLY = process.argv.includes("--apply");

const WEEK_FROM = "2026-07-27T00:00:00+05:00";
const WEEK_TO = "2026-08-03T00:00:00+05:00";
const EXPECT_BEFORE = 77;
const EXPECT_CREATE = 49;
const EXPECT_AFTER = 126;
const PLAN_PATH = new URL("./.tmp-plan.json", import.meta.url);
const OUT_PATH = new URL("./.restored-lessons.json", import.meta.url);

/** TOPICS из create-curriculum-plans-week.mjs, дословно. */
const TOPICS = {
  "Математика": {
    "3-А": ["Сложение чисел в пределах 100", "Вычитание с переходом через десяток", "Задачи на сложение и вычитание", "Умножение как повторное сложение", "Таблица умножения на 2 и 3", "Простые задачи на умножение", "Единицы измерения длины"],
    "7-А": ["Обыкновенные дроби: сложение и вычитание", "Умножение и деление дробей", "Десятичные дроби и их сравнение", "Проценты: нахождение процента от числа", "Проценты в жизненных задачах", "Линейные уравнения с одной переменной", "Решение задач с помощью уравнений"],
    "10-А": ["Понятие производной функции", "Производные элементарных функций", "Применение производной: экстремумы функции", "Первообразная и неопределённый интеграл", "Определённый интеграл и площадь фигуры", "Тригонометрические функции и их графики", "Тригонометрические уравнения"],
  },
  "Программирование": {
    "3-А": ["Знакомство со Scratch: спрайты и сцена", "Простые скрипты в Scratch: движение персонажа", "Циклы в Scratch: повторение действий", "Введение в Python: команда print", "Переменные в Python: числа и слова", "Простые вычисления в Python", "Ввод данных с клавиатуры (input)"],
    "7-А": ["Функции в Python: def и return", "Параметры функций", "Циклы for и while", "Списки: создание и обращение к элементам", "Методы списков: append, sort", "Условные конструкции if/elif/else", "Мини-проект: программа-калькулятор"],
    "10-А": ["Введение в ООП. Классы и объекты", "Наследование и полиморфизм", "Инкапсуляция и абстракция", "Работа с файлами в Python", "Введение в C++. Синтаксис", "Указатели и ссылки в C++", "Основы алгоритмов сортировки"],
  },
  "Робототехника": {
    "3-А": ["Что такое робототехника: простые механизмы", "Знакомство с платой Arduino", "Первая схема: подключение светодиода", "Управление светодиодом через Wokwi", "Мигающий светодиод: программа для Arduino", "Кнопка как источник сигнала", "Простой проект: светофор на светодиодах"],
    "7-А": ["Датчики температуры: подключение и считывание", "Датчик освещённости на Arduino", "Работа с ЖК-дисплеем", "Управление сервоприводом", "Датчик расстояния (ультразвуковой)", "Проект «Умный дом»: датчики + реле", "Отладка и тестирование схемы в Wokwi"],
    "10-А": ["Архитектура автономных систем", "Датчики движения и их калибровка", "Алгоритмы обхода препятствий", "Обратная связь и ПИД-регулирование (базово)", "Проектирование робота-манипулятора", "Связь между модулями (I2C/SPI, обзорно)", "Итоговый проект: автономный робот"],
  },
  "Английский язык": {
    "3-А": ["Английский алфавит", "Приветствия и знакомство", "Цвета вокруг нас", "Моя семья", "Числа от 1 до 20", "Животные и их названия", "Дни недели"],
    "7-А": ["Present Simple: утверждения и вопросы", "Present Continuous: действия сейчас", "Past Simple: правильные и неправильные глаголы", "Future Simple: планы на будущее", "Разговорная практика: рассказ о себе", "Чтение и обсуждение короткого текста", "Повторение времён: сравнение Present/Past/Future"],
    "10-А": ["Present Perfect vs Past Simple", "Условные предложения (Conditionals)", "Модальные глаголы для продвинутого уровня", "Структура эссе: introduction, body, conclusion", "Написание эссе-рассуждения (opinion essay)", "Знакомство с английской литературой: отрывок из классики", "Анализ художественного текста"],
  },
  "Русский язык": {
    "3-А": ["Имя существительное: что называет предмет", "Имя прилагательное: признак предмета", "Глагол: что делает предмет", "Простое предложение: подлежащее и сказуемое", "Заглавная буква в начале предложения", "Правописание безударных гласных", "Составление рассказа по картинке"],
    "7-А": ["Словосочетание и предложение", "Главные и второстепенные члены предложения", "Простое осложнённое предложение (однородные члены)", "Сложносочинённое предложение", "Сложноподчинённое предложение", "Пунктуация при однородных членах", "Знаки препинания в сложном предложении"],
    "10-А": ["Функциональные стили речи", "Художественный стиль: средства выразительности", "Анализ лирического произведения", "Анализ эпического произведения", "Сочинение-рассуждение по тексту", "Литературная критика: структура рецензии", "Практикум: написание рецензии"],
  },
};

const fail = (msg) => {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
};

console.log(`Режим: ${APPLY ? "--apply (ЗАПИСЬ)" : "ХОЛОСТОЙ ПРОГОН, ничего не пишется"}\n`);

// ── план ────────────────────────────────────────────────────────────────────
const plan = JSON.parse(fs.readFileSync(PLAN_PATH, "utf8"));
if (plan.length !== EXPECT_CREATE) fail(`в плане ${plan.length} уроков вместо ${EXPECT_CREATE}`);
if (plan.some((p) => !p.subject_id || !p.group_id)) fail("в плане есть строки без предмета или группы");

// ── что сейчас в базе ───────────────────────────────────────────────────────
const { data: existing, error: exErr } = await db
  .from("lessons").select("id, group_id, subject_id, starts_at, title, curriculum_topic_id")
  .eq("school_id", D).gte("starts_at", WEEK_FROM).lt("starts_at", WEEK_TO);
if (exErr) fail(`чтение уроков: ${exErr.message}`);
if (existing.length !== EXPECT_BEFORE) {
  fail(`в неделе ${existing.length} уроков, ожидалось ${EXPECT_BEFORE} — состояние не то, что при составлении плана`);
}

const { count: otherBefore } = await db
  .from("lessons").select("id", { count: "exact", head: true }).neq("school_id", D);

// занятые слоты — страховка от дубля, если план вдруг разошёлся с базой
const occupied = new Set(existing.map((l) => `${l.starts_at}|${l.group_id}`));

// ── темы ────────────────────────────────────────────────────────────────────
const { data: groups } = await db.from("groups").select("id, name").eq("school_id", D);
const gName = new Map(groups.map((g) => [g.id, g.name.replace(" класс", "")]));

// Ссылка на тему плана ставится только при точном совпадении названия.
const { data: plans, error: pErr } = await db
  .from("curriculum_plans").select("id, group_id, subject_id").eq("school_id", D);
if (pErr) fail(`чтение учебных планов: ${pErr.message}`);
const { data: planTopics, error: tErr } = await db
  .from("curriculum_plan_topics").select("id, plan_id, title").in("plan_id", plans.map((p) => p.id));
if (tErr) fail(`чтение тем плана: ${tErr.message}`);

const planOf = new Map(plans.map((p) => [`${p.group_id}|${p.subject_id}`, p.id]));
const topicIdBy = new Map(planTopics.map((t) => [`${t.plan_id}|${t.title}`, t.id]));
const topicIdFor = (groupId, subjectId, title) =>
  topicIdBy.get(`${planOf.get(`${groupId}|${subjectId}`)}|${title}`) ?? null;

// Названия, уже занятые уцелевшими уроками этой пары.
const usedTitles = new Map();
for (const l of existing) {
  const k = `${l.group_id}|${l.subject_id}`;
  if (!usedTitles.has(k)) usedTitles.set(k, new Set());
  usedTitles.get(k).add(l.title);
}

/** Очередь тем на пару предмет×группа: сперва свободные, затем повтор по кругу. */
const queues = new Map();
function nextTopic(groupId, subjectId, subjectName) {
  const key = `${groupId}|${subjectId}`;
  if (!queues.has(key)) {
    const all = TOPICS[subjectName]?.[gName.get(groupId)] ?? [];
    const used = usedTitles.get(key) ?? new Set();
    queues.set(key, [...all.filter((t) => !used.has(t)), ...all]);
  }
  const q = queues.get(key);
  return q.length ? q.shift() : null;
}

// ── что будет создано ───────────────────────────────────────────────────────
// Внутри пары идём по неделе по порядку: тема N+1 после темы N, а не вразнобой.
const ordered = [...plan].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

const rows = [];
for (const p of ordered) {
  if (occupied.has(`${p.starts_at}|${p.group_id}`)) fail(`слот уже занят: ${p.day} ${p.time} ${p.group}`);
  const title = nextTopic(p.group_id, p.subject_id, p.subject);
  if (!title) fail(`нет темы в списке: ${p.group} · ${p.subject}`);
  rows.push({
    school_id: D,
    group_id: p.group_id,
    subject_id: p.subject_id,
    title,
    topic: title,
    curriculum_topic_id: topicIdFor(p.group_id, p.subject_id, title),
    starts_at: p.starts_at,
    ends_at: new Date(new Date(p.starts_at).getTime() + 45 * 60000).toISOString(),
    duration_minutes: 45,
    room: "Кабинет 101",
    status: "scheduled",
    _label: `${p.day.slice(5)} ${p.time} ${gName.get(p.group_id)} · ${p.subject}`,
  });
}

console.log(`── БУДЕТ СОЗДАНО ${rows.length} УРОКОВ ──`);
for (const day of [...new Set(plan.map((p) => p.day))].sort()) {
  const inDay = rows.filter((r) => r.starts_at.startsWith(day));
  console.log(`\n${day} — ${inDay.length}`);
  for (const r of inDay.sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    console.log(`   ${r._label.slice(6).padEnd(30)} ${r.title}`);
  }
}

// Повтор темы внутри пары — не ошибка (в уцелевшем эталоне повторы есть), но
// пусть будет видно. Отдельно показываем, скольким проставилась ссылка на план.
const repeats = rows.filter((r) => (usedTitles.get(`${r.group_id}|${r.subject_id}`) ?? new Set()).has(r.title)).length;
const linked = rows.filter((r) => r.curriculum_topic_id).length;
console.log(`\nТем всего: ${rows.length}; повторяют тему уцелевшего урока: ${repeats}; со ссылкой на план: ${linked}, без ссылки: ${rows.length - linked}`);

// Тема обязана принадлежать своему предмету — это и была поломка в планах.
const wrong = rows.filter((r) => !(TOPICS[plan.find((p) => p.starts_at === r.starts_at && p.group_id === r.group_id)?.subject]?.[gName.get(r.group_id)] ?? []).includes(r.title));
if (wrong.length) fail(`${wrong.length} уроков получили тему чужого предмета — ${wrong[0]._label}: ${wrong[0].title}`);
console.log("Проверка: все темы принадлежат своему предмету — да.");

if (!APPLY) {
  console.log("\nХолостой прогон. Запуск с --apply создаст эти уроки.");
  process.exit(0);
}

// ── запись ──────────────────────────────────────────────────────────────────
const payload = rows.map(({ _label, ...r }) => r);
const created = [];
for (let i = 0; i < payload.length; i += 10) {
  const chunk = payload.slice(i, i + 10);
  const { data, error } = await db.from("lessons").insert(chunk).select("id, starts_at, group_id");
  if (error) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(created, null, 1));
    fail(`вставка на позиции ${i}: ${error.message}\nСозданное записано в ${OUT_PATH.pathname} — откатить можно по нему`);
  }
  created.push(...data);
}
fs.writeFileSync(OUT_PATH, JSON.stringify(created, null, 1));
console.log(`\nСоздано уроков: ${created.length}; идентификаторы в scripts/.restored-lessons.json`);

// ── проверка после записи ───────────────────────────────────────────────────
const { count: weekAfter } = await db.from("lessons").select("id", { count: "exact", head: true })
  .eq("school_id", D).gte("starts_at", WEEK_FROM).lt("starts_at", WEEK_TO);
const { count: otherAfter } = await db.from("lessons").select("id", { count: "exact", head: true }).neq("school_id", D);

console.log(`\nУроков в неделе: ${weekAfter} (ожидалось ${EXPECT_AFTER})`);
console.log(`Уроков в других школах: ${otherAfter} (было ${otherBefore})`);

if (weekAfter !== EXPECT_AFTER) fail(`в неделе ${weekAfter} уроков вместо ${EXPECT_AFTER}`);
if (otherAfter !== otherBefore) fail("изменилось число уроков в других школах");
console.log("\nГОТОВО. Цифры сошлись.");
