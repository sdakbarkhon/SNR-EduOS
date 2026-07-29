// ОДНОРАЗОВЫЙ скрипт — полная замена раздела "Проекты" (свои, не внешние)
// демо-данными для 3 классов демо-школы.
//
// ЧТО ДЕЛАЕТ:
//   Часть A — удаляет ВСЕ существующие projects для групп 3-А/7-А/10-А
//     класс (каскад ON DELETE CASCADE сам чистит project_stages,
//     project_submissions, project_stage_progress, project_attachments —
//     см. supabase/migrations/20260619000033_projects.sql).
//   Часть B — создаёт по 3 "своих" проекта на класс (Python/C++/Web —
//     ровно те заголовки, что заказаны в промте "Дашборд + Проекты"), у
//     каждого 5 генерик-этапов (Понять задание → Написать план → Написать
//     код → Протестировать → Показать учителю).
//   Часть C — на каждого ученика класса, для каждого проекта, независимо
//     разыгрывает состояние: 30% не начат (без submission вообще), 40% в
//     работе (2-4 из 5 этапов пройдено, "Написать код" содержит частичный
//     код), 30% отправлено учителю (все 5 этапов, is_submitted=true,
//     komментарий учителя из банка шаблонов, "Написать код" содержит
//     готовое решение).
//
// ЧТО НЕ ТРОГАЕТ: "внешние" проекты (Wokwi/GeoGebra/PhET) — они не имеют
// БД-бэкинга вообще (см. apps/web/app/(app)/projects/ProjectsView.tsx —
// статический каталог, всегда 0%/"Не начат", открывается в песочнице).
// Не трогает homework, lessons, attendance, students/teachers/groups/
// subjects.
//
// БЕЗОПАСНОСТЬ:
//   - Dry-run по умолчанию — печатает точный план, ни одного запроса на
//     запись не выполняется.
//   - Реальное выполнение — только при CONFIRM=YES (или --confirm).
//   - Идемпотентно: полная очистка в начале, повторный запуск с CONFIRM=YES
//     снова всё удалит и создаст заново.
//   - school_id пробрасывается явно на каждый INSERT (под service-role
//     клиентом current_school_id() резолвится в NULL — тот же паттерн,
//     что в reset-homework-generate-new.mjs).
//
// ЗАПУСК (bash, из apps/web):
//   node scripts/reset-projects.mjs                — dry-run
//   CONFIRM=YES node scripts/reset-projects.mjs     — реально
// ЗАПУСК (PowerShell, из apps/web):
//   node scripts/reset-projects.mjs                — dry-run
//   $env:CONFIRM="YES"; node scripts/reset-projects.mjs   — реально

import { makeServiceRoleClient, SCHOOL_ID, weightedPick, pick } from "./_backfill-shared.mjs";

const CONFIRMED = process.env.CONFIRM === "YES" || process.argv.includes("--confirm");

function fail(msg) {
  console.error(`\n!!! ОСТАНОВЛЕНО: ${msg}`);
  process.exit(1);
}

const CLASS_NAMES = ["3-А класс", "7-А класс", "10-А класс"];
const PROGRAMMING_SUBJECT = "Программирование";

const STAGE_TITLES = ["Понять задание", "Написать план", "Написать код", "Протестировать", "Показать учителю"];
const CODE_STAGE_INDEX = 2; // "Написать код" — сюда пишем student_notes с кодом

const PROJECTS_BY_CLASS = {
  "3-А класс": [
    {
      title: "Мой первый Python скрипт",
      description: "Напиши свой первый скрипт на Python: выведи на экран своё имя и любимое число.",
      template: `# Мой первый скрипт\n# Выведи на экран своё имя и любимое число\n\n`,
      solution: `# Мой первый скрипт\nname = "Ученик"\nfavorite_number = 7\n\nprint("Привет, меня зовут", name)\nprint("Моё любимое число:", favorite_number)\nprint("Число, увеличенное на 10:", favorite_number + 10)`,
    },
    {
      title: "Калькулятор",
      description: "Напиши простой калькулятор на Python: сложение, вычитание, умножение и деление двух чисел.",
      template: `# Калькулятор: сложение, вычитание, умножение, деление\na = 10\nb = 3\n\n# твой код здесь\n`,
      solution: `# Калькулятор: сложение, вычитание, умножение, деление\na = 10\nb = 3\n\nprint("Сумма:", a + b)\nprint("Разность:", a - b)\nprint("Произведение:", a * b)\nprint("Частное:", a / b)`,
    },
    {
      title: "Веб-страница о себе",
      description: "Сделай простую HTML-страницу с рассказом о себе: заголовок и пара абзацев.",
      template: `<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8">\n  <title>Обо мне</title>\n</head>\n<body>\n  <!-- Добавь заголовок и абзац о себе -->\n\n</body>\n</html>`,
      solution: `<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8">\n  <title>Обо мне</title>\n  <style>\n    body { font-family: Arial, sans-serif; text-align: center; background: #f4f6fb; }\n    h1 { color: #2D5BFF; }\n  </style>\n</head>\n<body>\n  <h1>Привет! Меня зовут Аня</h1>\n  <p>Мне 9 лет, я учусь в 3-А классе.</p>\n  <p>Люблю рисовать и играть в шахматы.</p>\n</body>\n</html>`,
    },
  ],
  "7-А класс": [
    {
      title: "Игра змейка на Python",
      description: "Сделай классическую игру Змейка на Pygame: движение змейки по игровому полю.",
      template: `import pygame\n\npygame.init()\nscreen = pygame.display.set_mode((400, 400))\n\n# Основной игровой цикл — добавь движение змейки\n`,
      solution: `import pygame\n\npygame.init()\nscreen = pygame.display.set_mode((400, 400))\nclock = pygame.time.Clock()\nsnake = [(200, 200)]\ndirection = (20, 0)\n\nrunning = True\nwhile running:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            running = False\n\n    head = (snake[0][0] + direction[0], snake[0][1] + direction[1])\n    snake.insert(0, head)\n    snake.pop()\n\n    screen.fill((0, 0, 0))\n    for segment in snake:\n        pygame.draw.rect(screen, (0, 200, 0), (*segment, 20, 20))\n    pygame.display.flip()\n    clock.tick(10)\n\npygame.quit()`,
    },
    {
      title: "Мой сайт-визитка",
      description: "Сделай сайт-визитку на HTML/CSS/JS: имя, короткое описание и кнопка «Написать мне».",
      template: `<!DOCTYPE html>\n<html lang="ru">\n<head><meta charset="UTF-8"><title>Визитка</title></head>\n<body>\n  <!-- Добавь имя и контакты -->\n\n  <script>\n    // Добавь кнопку "Написать мне"\n  </script>\n</body>\n</html>`,
      solution: `<!DOCTYPE html>\n<html lang="ru">\n<head>\n  <meta charset="UTF-8">\n  <title>Визитка — Тимур</title>\n  <style>\n    body { font-family: Arial; text-align: center; background: #1e293b; color: white; }\n    button { background: #0EA5E9; border: none; padding: 10px 20px; border-radius: 8px; color: white; }\n  </style>\n</head>\n<body>\n  <h1>Тимур Каримов</h1>\n  <p>Ученик 7-А класса, увлекаюсь программированием</p>\n  <button onclick="alert('Напишите на timur@example.com')">Написать мне</button>\n</body>\n</html>`,
    },
    {
      title: "Калькулятор функций на Python",
      description: "Используя модуль math, вычисли квадратный корень, синус и модуль числа.",
      template: `import math\n\nx = 16\n\n# Вычисли квадратный корень, синус и модуль числа x\n`,
      solution: `import math\n\nx = 16\n\nprint("Квадратный корень:", math.sqrt(x))\nprint("Синус:", math.sin(x))\nprint("Модуль -x:", abs(-x))\nprint("Округление вверх 3.2:", math.ceil(3.2))`,
    },
  ],
  "10-А класс": [
    {
      title: "Игра на C++",
      description: "Консольная игра «Угадай число» на C++: компьютер загадывает число, игрок угадывает.",
      template: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int secret = 42;\n    // Добавь цикл угадывания числа\n\n    return 0;\n}`,
      solution: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int secret = 42;\n    int guess;\n    int attempts = 0;\n\n    do {\n        cout << "Угадай число от 1 до 100: ";\n        cin >> guess;\n        attempts++;\n        if (guess < secret) cout << "Больше!" << endl;\n        else if (guess > secret) cout << "Меньше!" << endl;\n    } while (guess != secret);\n\n    cout << "Угадано за " << attempts << " попыток!" << endl;\n    return 0;\n}`,
    },
    {
      title: "Веб-приложение на JavaScript",
      description: "Небольшой список задач (todo list) на JavaScript: добавление, удаление, отметка выполнения.",
      template: `const tasks = [];\n\nfunction addTask(text) {\n  // Добавь задачу в массив tasks\n}\n\nfunction removeTask(index) {\n  // Удали задачу по индексу\n}\n`,
      solution: `const tasks = [];\n\nfunction addTask(text) {\n  tasks.push({ text, done: false });\n  console.log(\`Добавлено: \${text}\`);\n}\n\nfunction removeTask(index) {\n  tasks.splice(index, 1);\n  console.log("Задача удалена");\n}\n\nfunction toggleTask(index) {\n  tasks[index].done = !tasks[index].done;\n}\n\naddTask("Изучить массивы");\naddTask("Сделать домашнее задание");\ntoggleTask(0);\nconsole.log(tasks);`,
    },
    {
      title: "Анализ данных на Python",
      description: "Посчитай среднее, максимум и минимум по списку оценок средствами базового Python.",
      template: `scores = [85, 92, 78, 90, 88, 76, 95]\n\n# Найди среднее, максимум и минимум\n`,
      solution: `scores = [85, 92, 78, 90, 88, 76, 95]\n\naverage = sum(scores) / len(scores)\nmaximum = max(scores)\nminimum = min(scores)\n\nprint(f"Среднее: {average:.1f}")\nprint(f"Максимум: {maximum}")\nprint(f"Минимум: {minimum}")\nprint(f"Разброс: {maximum - minimum}")`,
    },
  ],
};

// Частичный код для "в работе" — первые ~55% строк решения (без ручного
// написания третьего варианта на каждый проект).
function partialCode(solution) {
  const lines = solution.split("\n");
  const cut = Math.max(1, Math.ceil(lines.length * 0.55));
  return lines.slice(0, cut).join("\n");
}

const PROJECT_TEACHER_COMMENTS = [
  "Отличная работа! Код чистый и рабочий.",
  "Хорошо сделано, видно, что тема понята.",
  "Молодец, задание выполнено полностью.",
  "Хорошая работа, но в следующий раз добавь больше комментариев в код.",
  "Всё получилось, поздравляю!",
  "Аккуратное решение, так держать!",
  "Проект зачтён, приятно было проверять.",
  "Отлично справился с задачей!",
];

const STATE_WEIGHTS = { not_started: 0.3, in_progress: 0.4, submitted: 0.3 };

async function main() {
  const db = makeServiceRoleClient();
  console.log(`Режим: ${CONFIRMED ? "РЕАЛЬНОЕ ВЫПОЛНЕНИЕ (CONFIRM=YES)" : "DRY-RUN (ничего не пишется в БД)"}\n`);

  // ── Резолвим группы/предмет/учителя/учеников из БД ──
  const { data: groups, error: groupsErr } = await db.from("groups").select("id, name").in("name", CLASS_NAMES);
  if (groupsErr) fail(`Ошибка запроса groups: ${groupsErr.message}`);
  const groupByName = new Map(groups.map((g) => [g.name, g]));
  for (const name of CLASS_NAMES) if (!groupByName.has(name)) fail(`Группа "${name}" не найдена в БД.`);

  const { data: subjects, error: subjErr } = await db
    .from("subjects")
    .select("id, group_id, teacher_id, school_id")
    .eq("name", PROGRAMMING_SUBJECT)
    .eq("is_active", true)
    .in("group_id", groups.map((g) => g.id));
  if (subjErr) fail(`Ошибка запроса subjects: ${subjErr.message}`);
  const subjectByGroupId = new Map(subjects.map((s) => [s.group_id, s]));
  for (const name of CLASS_NAMES) {
    const g = groupByName.get(name);
    if (!subjectByGroupId.has(g.id)) fail(`Не найден активный предмет "${PROGRAMMING_SUBJECT}" для группы "${name}".`);
    if (!subjectByGroupId.get(g.id).teacher_id) fail(`У предмета "${PROGRAMMING_SUBJECT}" группы "${name}" не заполнен teacher_id.`);
  }

  const { data: students, error: stuErr } = await db
    .from("students")
    .select("id, username, student_groups(group_id)")
    .order("username");
  if (stuErr) fail(`Ошибка запроса students: ${stuErr.message}`);
  const studentsByGroup = new Map(CLASS_NAMES.map((n) => [groupByName.get(n).id, []]));
  for (const s of students) {
    const gid = s.student_groups?.[0]?.group_id;
    if (gid && studentsByGroup.has(gid)) studentsByGroup.get(gid).push(s);
  }
  for (const name of CLASS_NAMES) {
    const list = studentsByGroup.get(groupByName.get(name).id);
    console.log(`Группа "${name}": ${list.length} учеников найдено.`);
  }
  console.log();

  // ═══════════════════════════ ЧАСТЬ A — УДАЛЕНИЕ ═══════════════════════════
  const groupIds = groups.map((g) => g.id);
  const { data: existingProjects, error: exErr } = await db.from("projects").select("id, title").in("group_id", groupIds);
  if (exErr) fail(`Ошибка запроса projects: ${exErr.message}`);
  console.log(`=== ЧАСТЬ A: найдено ${existingProjects.length} существующих проектов для 3-А/7-А/10-А (удаляются каскадом) ===`);
  for (const p of existingProjects) console.log(`  - ${p.title} (${p.id})`);
  console.log();

  // ═══════════════════════════ ЧАСТЬ B/C — ПЛАН СОЗДАНИЯ ═════════════════════
  let totalProjects = 0, totalSubmissions = 0, totalNotStarted = 0, totalInProgress = 0, totalSubmitted = 0;
  const plan = [];
  for (const className of CLASS_NAMES) {
    const group = groupByName.get(className);
    const subject = subjectByGroupId.get(group.id);
    const projectDefs = PROJECTS_BY_CLASS[className];
    const classStudents = studentsByGroup.get(group.id);

    for (const def of projectDefs) {
      totalProjects++;
      const perStudent = classStudents.map((s) => ({ student: s, state: weightedPick(STATE_WEIGHTS) }));
      for (const { state } of perStudent) {
        if (state === "not_started") totalNotStarted++;
        else {
          totalSubmissions++;
          if (state === "in_progress") totalInProgress++;
          else totalSubmitted++;
        }
      }
      plan.push({ className, group, subject, def, perStudent });
      console.log(`  [${className}] "${def.title}" — ${classStudents.length} учеников: ` +
        `${perStudent.filter((p) => p.state === "not_started").length} не начат / ` +
        `${perStudent.filter((p) => p.state === "in_progress").length} в работе / ` +
        `${perStudent.filter((p) => p.state === "submitted").length} отправлено`);
    }
  }
  console.log(`\n=== ЧАСТЬ B/C: план — ${totalProjects} проектов (по 3 на класс), ${totalSubmissions} submissions ` +
    `(${totalNotStarted} без submission, ${totalInProgress} в работе, ${totalSubmitted} отправлено) ===\n`);

  if (!CONFIRMED) {
    console.log("DRY-RUN — ничего не записано. Запусти с CONFIRM=YES для реального выполнения.");
    return;
  }

  // ═══════════════════════════ ВЫПОЛНЕНИЕ ═══════════════════════════════════
  if (existingProjects.length > 0) {
    const { error: delErr } = await db.from("projects").delete().in("id", existingProjects.map((p) => p.id));
    if (delErr) fail(`Ошибка удаления projects: ${delErr.message}`);
    console.log(`Удалено ${existingProjects.length} старых проектов (каскад).`);
  }

  let createdProjects = 0, createdSubmissions = 0;
  for (const { className, group, subject, def, perStudent } of plan) {
    const { data: proj, error: projErr } = await db.from("projects").insert({
      school_id: SCHOOL_ID,
      group_id: group.id,
      subject: "programming",
      title: def.title,
      description: def.description,
      created_by: subject.teacher_id,
    }).select("id").single();
    if (projErr) fail(`Ошибка создания проекта "${def.title}" (${className}): ${projErr.message}`);
    createdProjects++;

    const stageRows = STAGE_TITLES.map((title, i) => ({
      school_id: SCHOOL_ID, project_id: proj.id, position: i, title,
    }));
    const { data: stages, error: stagesErr } = await db.from("project_stages").insert(stageRows).select("id, position");
    if (stagesErr) fail(`Ошибка создания этапов для "${def.title}": ${stagesErr.message}`);
    const stageIdByPos = new Map(stages.map((s) => [s.position, s.id]));
    const codeStageId = stageIdByPos.get(CODE_STAGE_INDEX);

    for (const { student, state } of perStudent) {
      if (state === "not_started") continue;

      const isSubmitted = state === "submitted";
      const { data: sub, error: subErr } = await db.from("project_submissions").insert({
        school_id: SCHOOL_ID,
        project_id: proj.id,
        student_id: student.id,
        is_submitted: isSubmitted,
        submitted_at: isSubmitted ? new Date().toISOString() : null,
        teacher_comment: isSubmitted ? pick(PROJECT_TEACHER_COMMENTS) : null,
      }).select("id").single();
      if (subErr) fail(`Ошибка создания submission (${student.username}, "${def.title}"): ${subErr.message}`);
      createdSubmissions++;

      const completedCount = isSubmitted ? STAGE_TITLES.length : [2, 3, 4][Math.floor(Math.random() * 3)];
      const progressRows = [];
      for (let i = 0; i < STAGE_TITLES.length; i++) {
        const done = i < completedCount;
        const isCodeStage = i === CODE_STAGE_INDEX;
        if (!done && !isCodeStage) continue; // не трогаем непройденные не-кодовые этапы
        progressRows.push({
          school_id: SCHOOL_ID,
          submission_id: sub.id,
          stage_id: stageIdByPos.get(i),
          is_completed: done,
          completed_at: done ? new Date().toISOString() : null,
          student_notes: isCodeStage ? (isSubmitted ? def.solution : partialCode(def.solution)) : null,
        });
      }
      if (progressRows.length > 0) {
        const { error: progErr } = await db.from("project_stage_progress").insert(progressRows);
        if (progErr) fail(`Ошибка записи прогресса (${student.username}, "${def.title}"): ${progErr.message}`);
      }
    }
  }

  console.log(`\nГотово: создано ${createdProjects} проектов, ${createdSubmissions} submissions.`);
}

main().catch((e) => fail(e.stack ?? String(e)));
