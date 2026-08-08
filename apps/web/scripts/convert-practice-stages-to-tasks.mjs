#!/usr/bin/env node
// 08.08.2026 — превращает «Практическую работу», которая была слайд-шоу, в
// настоящее задание. Решение заказчика, третий вариант из отчёта за 08.08.
//
// Что делает с каждым этапом:
//   Программирование, тема про Scratch  -> content_type='scratch'
//   Программирование, остальные темы    -> content_type='code' + стартовый код
//   Робототехника                       -> content_type='wokwi'
//   Две темы без схемы (см. RENAME_ONLY) -> только переименование, тип прежний
// Плюс пустой этап «Циклы» (10-А, 29.07) — у него нет ни слайдов, ни описания.
//
// Ссылку на проект внешнего сервиса НЕ проставляем намеренно: рендер
// подставляет дефолтный редактор (DEFAULT_SERVICE_URL в
// lib/external-services.ts) — пустой Wokwi для сборки схемы с нуля и наш
// Scratch. Готовых схем под темы у нас нет и создать их нечем: проекты Wokwi
// живут на их сайте и требуют аккаунта. Заказчик это подтвердил: ученик
// собирает сам, а что именно — объясняет текст задания.
//
// СЛАЙДЫ НЕ ТЕРЯЮТСЯ. Показ слайдов в LessonWorkspaceView завязан на сам факт
// slides.length > 0, а НЕ на content_type — оставь мы их, у задания
// по-прежнему открывалось бы слайд-шоу. Поэтому slides переезжают в
// config.replaced_slides (данные целы, UI их не читает), а колонка обнуляется.
//
// Промты генерации этапов (lib/ai/prompts.ts) НЕ трогаются — здесь свой
// узкий запрос на содержимое ОДНОГО задания.
//
// ЗАПУСК (из apps/web):
//   node scripts/convert-practice-stages-to-tasks.mjs           # прогон, без Gemini и без записи
//   node scripts/convert-practice-stages-to-tasks.mjs --apply   # генерация + запись

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { GoogleGenerativeAI } from "@google/generative-ai";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const DEMO_SCHOOL = "a0a0a0a0-0000-0000-0000-000000000001";

/** Темы, под которые схемы в принципе нет — там нечего собирать.
 *  Переименовываем так же, как поступили с математикой/русским/английским. */
const RENAME_ONLY = ["Что такое робототехника: простые механизмы", "Архитектура автономных систем"];
const RENAME_TITLE = "Разбор примеров";

const MIN_INTERVAL_MS = 6500;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;
if (APPLY && !genAI) {
  console.error("FATAL: GEMINI_API_KEY отсутствует в .env.local");
  process.exit(1);
}

function targetType(subject, topic) {
  if (subject === "Робототехника") return "wokwi";
  if (/scratch/i.test(topic)) return "scratch";
  return "code";
}

function buildPrompt({ subject, grade, topic, type }) {
  const common = `Урок: ${subject}, ${grade} класс. Тема: "${topic}".
Нужно СОДЕРЖИМОЕ для этапа «Практическая работа» — ученик должен что-то СДЕЛАТЬ сам.
Пиши по-русски, обращайся к ученику на «ты», уровень строго под ${grade} класс.`;

  if (type === "code") {
    return `${common}
Среда: редактор кода Python (для тем по C++ — C++).
Верни ТОЛЬКО JSON без markdown:
{"description":"условие задачи: что написать, 2-4 предложения, конкретно","starter_code":"скелет программы с комментариями TODO, без готового решения","language":"python или cpp"}`;
  }
  if (type === "wokwi") {
    return `${common}
Среда: симулятор Wokwi, ПУСТОЙ редактор Arduino — схемы заранее нет, ученик собирает её сам.
Верни ТОЛЬКО JSON без markdown:
{"description":"задание: какие детали взять, как соединить и что должна делать программа. Перечисли компоненты и пины явно. 3-6 предложений","starter_code":"скетч Arduino с комментариями TODO, без готового решения","language":"cpp"}`;
  }
  return `${common}
Среда: Scratch, блочное программирование, младшие классы.
Верни ТОЛЬКО JSON без markdown:
{"description":"задание словами: что собрать из блоков и что должно получиться. Простыми словами, 3-5 предложений","starter_code":"","language":""}`;
}

function stripFences(t) {
  return t.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function generate(prompt) {
  let lastErr = "unknown";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });
      const res = await model.generateContent(prompt);
      const parsed = JSON.parse(stripFences(res.response.text().trim()));
      if (typeof parsed?.description === "string" && parsed.description.trim()) return parsed;
      lastErr = "пустой description";
    } catch (e) {
      lastErr = e.message ?? String(e);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw new Error(lastErr);
}

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `SELECT st.id, st.title, st.slides, st.config, s.name AS subject, g.name AS group_name,
          COALESCE(l.title, l.topic, '') AS topic,
          to_char(l.starts_at + interval '5 hours', 'DD.MM') AS day
     FROM lesson_stages st
     JOIN lessons l ON l.id = st.lesson_id
     JOIN groups g ON g.id = l.group_id
     JOIN subjects s ON s.id = l.subject_id
    WHERE l.school_id = $1
      AND st.content_type = 'presentation'
      AND s.name IN ('Программирование', 'Робототехника')
      AND (st.title = 'Практическая работа' OR st.slides IS NULL OR jsonb_array_length(st.slides) = 0)
    ORDER BY s.name, g.name, l.starts_at`,
  [DEMO_SCHOOL],
);

const gradeOf = (name) => {
  const m = (name ?? "").match(/(\d{1,2})/);
  return m ? parseInt(m[1], 10) : 7;
};

const plan = rows.map((r) => ({
  ...r,
  grade: gradeOf(r.group_name),
  action: RENAME_ONLY.includes(r.topic) ? "rename" : "convert",
  type: RENAME_ONLY.includes(r.topic) ? null : targetType(r.subject, r.topic),
}));

console.log(`Режим: ${APPLY ? "--apply (генерация и запись)" : "прогон, Gemini не вызывается"}\n`);
console.log("── ПЛАН ──");
console.table(
  plan.map((p) => ({
    предмет: p.subject,
    группа: p.group_name,
    день: p.day,
    этап: p.title,
    тема: p.topic.slice(0, 40),
    действие: p.action === "rename" ? `переименовать -> ${RENAME_TITLE}` : `тип -> ${p.type}`,
  })),
);
const byType = {};
for (const p of plan) byType[p.action === "rename" ? "переименование" : p.type] = (byType[p.action === "rename" ? "переименование" : p.type] ?? 0) + 1;
console.log("Итого:", JSON.stringify(byType), `= ${plan.length} этапов`);

if (!APPLY) {
  console.log("\nПрогон. Запуск с --apply сгенерирует содержимое и запишет.");
  await client.end();
  process.exit(0);
}

let done = 0;
const failed = [];
for (const p of plan) {
  try {
    if (p.action === "rename") {
      await client.query(`UPDATE lesson_stages SET title = $2 WHERE id = $1`, [p.id, RENAME_TITLE]);
      console.log(`  ${p.subject} ${p.group_name} ${p.day} — переименован`);
      done++;
      continue;
    }

    const out = await generate(buildPrompt({ subject: p.subject, grade: p.grade, topic: p.topic, type: p.type }));
    // Старые слайды переезжают в config, чтобы не пропасть и не рендериться.
    const nextConfig = { ...(p.config ?? {}) };
    if (Array.isArray(p.slides) && p.slides.length) nextConfig.replaced_slides = p.slides;

    await client.query(
      `UPDATE lesson_stages
          SET content_type = $2,
              stage_type = 'task',
              title = 'Практическая работа',
              description = $3,
              starter_code = NULLIF($4, ''),
              programming_language = NULLIF($5, ''),
              config = $6::jsonb,
              slides = NULL
        WHERE id = $1`,
      [p.id, p.type, out.description.trim(), (out.starter_code ?? "").trim(), (out.language ?? "").trim(), JSON.stringify(nextConfig)],
    );
    console.log(`  ${p.subject} ${p.group_name} ${p.day} — ${p.type}: ${out.description.slice(0, 60)}…`);
    done++;
  } catch (e) {
    failed.push(`${p.subject} ${p.group_name} ${p.day} (${p.topic}): ${e.message}`);
    console.error(`  !! ${p.subject} ${p.group_name} ${p.day}: ${e.message}`);
  }
}

console.log(`\nОбработано: ${done}/${plan.length}, ошибок: ${failed.length}`);
for (const f of failed) console.log("  " + f);

console.log("\n── ПРОВЕРКА ──");
console.table(
  (
    await client.query(
      `SELECT s.name AS предмет, st.content_type AS тип, count(*)::int AS этапов,
              count(*) FILTER (WHERE COALESCE(st.description,'') <> '')::int AS с_заданием,
              count(*) FILTER (WHERE st.slides IS NOT NULL AND jsonb_array_length(st.slides) > 0)::int AS ещё_со_слайдами
         FROM lesson_stages st
         JOIN lessons l ON l.id = st.lesson_id
         JOIN subjects s ON s.id = l.subject_id
        WHERE l.school_id = $1 AND s.name IN ('Программирование', 'Робототехника')
          AND st.title IN ('Практическая работа', 'Разбор примеров')
        GROUP BY 1, 2 ORDER BY 1, 3 DESC`,
      [DEMO_SCHOOL],
    )
  ).rows,
);
await client.end();
