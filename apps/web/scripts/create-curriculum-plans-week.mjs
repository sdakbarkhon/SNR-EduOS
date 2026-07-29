#!/usr/bin/env node
// Регенерация 29.07, ЭТАП 2 — учебные планы на неделю 27.07-02.08 демо-школы.
// Запускается сразу (без --confirm) — INSERT в пустую таблицу
// (curriculum_plans после Этапа 1 пуста для демо-школы), не разрушительно.
//
// СХЕМА (supabase/migrations/116_curriculum_plans.sql, RLS доп. в 120 —
// колонки не менялись):
//   curriculum_plans: id, group_id, subject_id, teacher_id, school_id,
//     title, source_file_url, source_file_type, created_at.
//     UNIQUE(group_id, subject_id) — ровно один план на пару предмет×группа.
//   curriculum_plan_topics: id, plan_id (CASCADE), order_index, title,
//     description, estimated_lessons (default 1). Своей school_id не имеет
//     (доступ через plan_id → curriculum_plans, тот же паттерн, что
//     lesson_stages → lessons).
//
// ИДЕМПОТЕНТНОСТЬ: UNIQUE(group_id, subject_id) не даёт вставить дубль
// плана — если план для пары уже есть, скрипт обновляет его title и
// ПОЛНОСТЬЮ заменяет темы (удаляет старые curriculum_plan_topics, вставляет
// 7 новых). Повторный запуск безопасен.
//
// teacher_id — берётся из subjects.teacher_id (модель "1 предмет = 1
// учитель", см. миграцию 109/120) — НЕ groups.teacher_id (тот жёстко
// указывает на teacher_karim-куратора для всех 3 групп, что было бы неверно
// для остальных 4 предметов).
//
// ЗАПУСК (из apps/web):
//   node --env-file=.env.local scripts/create-curriculum-plans-week.mjs

import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";

const db = makeServiceRoleClient();

const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];
const SUBJECT_NAMES = ["Программирование", "Робототехника", "Математика", "Английский язык", "Русский язык"];
const WEEK_LABEL = "27.07–02.08";

// 15 планов × 7 тем — дифференцировано по уровню класса, темы логически
// связаны в последовательность урок-за-уроком.
const TOPICS = {
  "Математика": {
    "3-А класс": [
      "Сложение чисел в пределах 100",
      "Вычитание с переходом через десяток",
      "Задачи на сложение и вычитание",
      "Умножение как повторное сложение",
      "Таблица умножения на 2 и 3",
      "Простые задачи на умножение",
      "Единицы измерения длины",
    ],
    "7-А класс": [
      "Обыкновенные дроби: сложение и вычитание",
      "Умножение и деление дробей",
      "Десятичные дроби и их сравнение",
      "Проценты: нахождение процента от числа",
      "Проценты в жизненных задачах",
      "Линейные уравнения с одной переменной",
      "Решение задач с помощью уравнений",
    ],
    "10-А класс": [
      "Понятие производной функции",
      "Производные элементарных функций",
      "Применение производной: экстремумы функции",
      "Первообразная и неопределённый интеграл",
      "Определённый интеграл и площадь фигуры",
      "Тригонометрические функции и их графики",
      "Тригонометрические уравнения",
    ],
  },
  "Программирование": {
    "3-А класс": [
      "Знакомство со Scratch: спрайты и сцена",
      "Простые скрипты в Scratch: движение персонажа",
      "Циклы в Scratch: повторение действий",
      "Введение в Python: команда print",
      "Переменные в Python: числа и слова",
      "Простые вычисления в Python",
      "Ввод данных с клавиатуры (input)",
    ],
    "7-А класс": [
      "Функции в Python: def и return",
      "Параметры функций",
      "Циклы for и while",
      "Списки: создание и обращение к элементам",
      "Методы списков: append, sort",
      "Условные конструкции if/elif/else",
      "Мини-проект: программа-калькулятор",
    ],
    "10-А класс": [
      "Введение в ООП. Классы и объекты",
      "Наследование и полиморфизм",
      "Инкапсуляция и абстракция",
      "Работа с файлами в Python",
      "Введение в C++. Синтаксис",
      "Указатели и ссылки в C++",
      "Основы алгоритмов сортировки",
    ],
  },
  "Робототехника": {
    "3-А класс": [
      "Что такое робототехника: простые механизмы",
      "Знакомство с платой Arduino",
      "Первая схема: подключение светодиода",
      "Управление светодиодом через Wokwi",
      "Мигающий светодиод: программа для Arduino",
      "Кнопка как источник сигнала",
      "Простой проект: светофор на светодиодах",
    ],
    "7-А класс": [
      "Датчики температуры: подключение и считывание",
      "Датчик освещённости на Arduino",
      "Работа с ЖК-дисплеем",
      "Управление сервоприводом",
      "Датчик расстояния (ультразвуковой)",
      "Проект «Умный дом»: датчики + реле",
      "Отладка и тестирование схемы в Wokwi",
    ],
    "10-А класс": [
      "Архитектура автономных систем",
      "Датчики движения и их калибровка",
      "Алгоритмы обхода препятствий",
      "Обратная связь и ПИД-регулирование (базово)",
      "Проектирование робота-манипулятора",
      "Связь между модулями (I2C/SPI, обзорно)",
      "Итоговый проект: автономный робот",
    ],
  },
  "Английский язык": {
    "3-А класс": [
      "Английский алфавит",
      "Приветствия и знакомство",
      "Цвета вокруг нас",
      "Моя семья",
      "Числа от 1 до 20",
      "Животные и их названия",
      "Дни недели",
    ],
    "7-А класс": [
      "Present Simple: утверждения и вопросы",
      "Present Continuous: действия сейчас",
      "Past Simple: правильные и неправильные глаголы",
      "Future Simple: планы на будущее",
      "Разговорная практика: рассказ о себе",
      "Чтение и обсуждение короткого текста",
      "Повторение времён: сравнение Present/Past/Future",
    ],
    "10-А класс": [
      "Present Perfect vs Past Simple",
      "Условные предложения (Conditionals)",
      "Модальные глаголы для продвинутого уровня",
      "Структура эссе: introduction, body, conclusion",
      "Написание эссе-рассуждения (opinion essay)",
      "Знакомство с английской литературой: отрывок из классики",
      "Анализ художественного текста",
    ],
  },
  "Русский язык": {
    "3-А класс": [
      "Имя существительное: что называет предмет",
      "Имя прилагательное: признак предмета",
      "Глагол: что делает предмет",
      "Простое предложение: подлежащее и сказуемое",
      "Заглавная буква в начале предложения",
      "Правописание безударных гласных",
      "Составление рассказа по картинке",
    ],
    "7-А класс": [
      "Словосочетание и предложение",
      "Главные и второстепенные члены предложения",
      "Простое осложнённое предложение (однородные члены)",
      "Сложносочинённое предложение",
      "Сложноподчинённое предложение",
      "Пунктуация при однородных членах",
      "Знаки препинания в сложном предложении",
    ],
    "10-А класс": [
      "Функциональные стили речи",
      "Художественный стиль: средства выразительности",
      "Анализ лирического произведения",
      "Анализ эпического произведения",
      "Сочинение-рассуждение по тексту",
      "Литературная критика: структура рецензии",
      "Практикум: написание рецензии",
    ],
  },
};

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`Учебные планы на неделю ${WEEK_LABEL} — демо-школа (${SCHOOL_ID})\n`);

  const { data: groups, error: gErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (gErr) fail(`Ошибка запроса groups: ${gErr.message}`);
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  for (const name of CLASS_NAMES) if (!groupByName.has(name)) fail(`Группа "${name}" не найдена в БД.`);

  const { data: subjects, error: sErr } = await db
    .from("subjects")
    .select("id, name, group_id, teacher_id, school_id")
    .in("name", SUBJECT_NAMES)
    .in("group_id", groups.map((g) => g.id))
    .eq("is_active", true);
  if (sErr) fail(`Ошибка запроса subjects: ${sErr.message}`);
  const subjectByGroupAndName = new Map(subjects.map((s) => [`${s.group_id}|${s.name}`, s]));
  for (const className of CLASS_NAMES) {
    const gid = groupByName.get(className).id;
    for (const subjName of SUBJECT_NAMES) {
      const s = subjectByGroupAndName.get(`${gid}|${subjName}`);
      if (!s) fail(`Не найден активный предмет "${subjName}" для группы "${className}".`);
      if (!s.teacher_id) fail(`У предмета "${subjName}" (${className}) не заполнен teacher_id.`);
    }
  }

  let created = 0, updated = 0, topicsWritten = 0;

  for (const subjectName of SUBJECT_NAMES) {
    for (const className of CLASS_NAMES) {
      const group = groupByName.get(className);
      const subject = subjectByGroupAndName.get(`${group.id}|${subjectName}`);
      const topics = TOPICS[subjectName][className];
      if (!topics || topics.length !== 7) fail(`Ожидалось ровно 7 тем для "${subjectName}" / "${className}", найдено ${topics?.length ?? 0}.`);

      const title = `${subjectName} — ${className}, неделя ${WEEK_LABEL}`;

      const { data: existing, error: exErr } = await db
        .from("curriculum_plans")
        .select("id")
        .eq("group_id", group.id)
        .eq("subject_id", subject.id)
        .maybeSingle();
      if (exErr) fail(`Ошибка поиска существующего плана (${subjectName}/${className}): ${exErr.message}`);

      let planId;
      if (existing) {
        planId = existing.id;
        const { error: updErr } = await db.from("curriculum_plans").update({ title }).eq("id", planId);
        if (updErr) fail(`Ошибка обновления плана (${subjectName}/${className}): ${updErr.message}`);
        const { error: delErr } = await db.from("curriculum_plan_topics").delete().eq("plan_id", planId);
        if (delErr) fail(`Ошибка удаления старых тем (${subjectName}/${className}): ${delErr.message}`);
        updated++;
        console.log(`[обновлён] ${title}`);
      } else {
        const { data: inserted, error: insErr } = await db.from("curriculum_plans").insert({
          school_id: SCHOOL_ID,
          group_id: group.id,
          subject_id: subject.id,
          teacher_id: subject.teacher_id,
          title,
        }).select("id").single();
        if (insErr) fail(`Ошибка создания плана (${subjectName}/${className}): ${insErr.message}`);
        planId = inserted.id;
        created++;
        console.log(`[создан]   ${title}`);
      }

      const topicRows = topics.map((topicTitle, i) => ({
        plan_id: planId,
        order_index: i,
        title: topicTitle,
        estimated_lessons: 1,
      }));
      const { error: topErr } = await db.from("curriculum_plan_topics").insert(topicRows);
      if (topErr) fail(`Ошибка вставки тем (${subjectName}/${className}): ${topErr.message}`);
      topicsWritten += topicRows.length;
    }
  }

  console.log(`\nГотово: создано ${created}, обновлено ${updated} планов (итого ${created + updated}), записано ${topicsWritten} тем.`);

  const { count, error: cntErr } = await db.from("curriculum_plans").select("*", { count: "exact", head: true }).eq("school_id", SCHOOL_ID);
  if (cntErr) fail(`Ошибка финального подсчёта: ${cntErr.message}`);
  console.log(`Проверка: curriculum_plans для демо-школы — ${count} (ожидание 15).`);
}

main().catch((e) => fail(e.stack ?? String(e)));
