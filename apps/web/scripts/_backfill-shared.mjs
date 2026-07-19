// Промт 7.3: shared helpers for the backfill-*.mjs scripts.
// No external API calls anywhere in this file or its callers — everything
// is hardcoded templates + local randomness, per explicit instruction.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

export function loadEnvLocal() {
  const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

export function makeServiceRoleClient() {
  const env = loadEnvLocal();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const SCHOOL_ID = "a0a0a0a0-0000-0000-0000-000000000001";

// Пачка «240 пустых уроков», ЧАСТЬ 3 — RU-название предмета урока
// (lessons.subject_id -> subjects.name) -> slug books.subject. Зеркалит
// packages/core/src/config/subjects.ts (там же getSubjectKeyByLabel() —
// тот же маппинг для TS/TSX-кода приложения, единый источник правды); .mjs-
// скрипты в apps/web/scripts не импортируют @snr/core (нет build-шага для
// пакета), поэтому здесь — намеренная зеркальная копия, держать в синхроне
// вручную при добавлении новых предметов.
export const SUBJECT_NAME_TO_BOOK_SLUG = {
  "Программирование": "programming",
  "Робототехника": "robotics",
  "Математика": "math",
  "Английский язык": "english",
  "Русский язык": "russian",
};

// Прицепляет до maxBooks книг БЗ того же предмета к уроку, БЕЗ дублирования
// файла (copy-by-reference: file_storage_path/kb_bucket='books' — та же
// insert-схема, что linkLessonMaterialFromKnowledgeBase в
// packages/core/src/queries/index.ts, реиспользовать который отсюда нельзя
// см. выше). Идемпотентно: если у урока уже есть хоть один
// kb_bucket='books' материал — пропускает целиком (не пытается точечно
// дедуплицировать по конкретной книге). db — service-role клиент: пишет
// school_id ЯВНО, т.к. DEFAULT current_school_id() у lesson_materials
// зависит от auth.uid(), которого нет под service-role.
export async function attachBooksToLesson(db, { lessonId, subjectName, teacherId, maxBooks = 3 }) {
  const slug = SUBJECT_NAME_TO_BOOK_SLUG[subjectName ?? ""];
  if (!slug) return { attached: 0, reason: "no_slug_mapping" };

  const { data: existing, error: existErr } = await db
    .from("lesson_materials")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("kb_bucket", "books")
    .limit(1);
  if (existErr) throw new Error(`attachBooksToLesson existing check: ${existErr.message}`);
  if (existing?.length) return { attached: 0, reason: "already_has_materials" };

  const { data: books, error: booksErr } = await db
    .from("books")
    .select("id, title, file_storage_path, file_size_bytes")
    .eq("subject", slug)
    .order("created_at", { ascending: true })
    .limit(maxBooks);
  if (booksErr) throw new Error(`attachBooksToLesson books fetch: ${booksErr.message}`);
  if (!books?.length) return { attached: 0, reason: "no_books_for_subject" };

  const rows = books.map((b) => ({
    lesson_id: lessonId,
    school_id: SCHOOL_ID,
    title: b.title,
    file_storage_path: b.file_storage_path,
    file_size_bytes: b.file_size_bytes,
    file_original_name: b.title,
    uploaded_by: teacherId ?? null,
    visibility: "all",
    from_knowledge_base: true,
    kb_bucket: "books",
  }));
  const { error: insErr } = await db.from("lesson_materials").insert(rows);
  if (insErr) throw new Error(`attachBooksToLesson insert: ${insErr.message}`);
  return { attached: rows.length, reason: "ok" };
}

// Промт 8.2: + 3 новых реальных ученика (rustam_03/farrukh_10/malika_07,
// миграция 125) — по профилю зеркалят одного из исходных трёх (см. ниже).
export const REAL_STUDENT_USERNAMES = ["sherzod_10", "nodira_07", "aziz_03", "rustam_03", "farrukh_10", "malika_07"];

// Промт 7.3: профили реальных учеников — распределение оценок (веса, не проценты
// строго — normalizeWeights ниже приводит к сумме 1).
export const GRADE_PROFILES = {
  sherzod_10: { 5: 0.70, 4: 0.25, 3: 0.05 },
  nodira_07: { 4: 0.60, 5: 0.25, 3: 0.15 },
  aziz_03: { 3: 0.40, 4: 0.40, 5: 0.15, 2: 0.05 },
  // Промт 8.2: farrukh_10 — отличник (= sherzod_10), rustam_03 — хорошист
  // (= nodira_07), malika_07 — средний (= aziz_03), по прямому указанию промта.
  farrukh_10: { 5: 0.70, 4: 0.25, 3: 0.05 },
  rustam_03: { 4: 0.60, 5: 0.25, 3: 0.15 },
  malika_07: { 3: 0.40, 4: 0.40, 5: 0.15, 2: 0.05 },
};
// Демо-ученики — рандом по «нормальному» распределению 3-5 (без 1-2, редкая 2 у демо не нужна).
export const DEMO_GRADE_PROFILE = { 5: 0.30, 4: 0.45, 3: 0.25 };

export const HOMEWORK_PROFILES = {
  sherzod_10: { onTime: 0.95, late: 0.05, missed: 0.0 },
  nodira_07: { onTime: 0.85, late: 0.10, missed: 0.05 },
  aziz_03: { onTime: 0.70, late: 0.20, missed: 0.10 },
  farrukh_10: { onTime: 0.95, late: 0.05, missed: 0.0 },
  rustam_03: { onTime: 0.85, late: 0.10, missed: 0.05 },
  malika_07: { onTime: 0.70, late: 0.20, missed: 0.10 },
};
export const DEMO_HOMEWORK_PROFILE = { onTime: 0.75, late: 0.15, missed: 0.10 };

export function weightedPick(weights) {
  const r = Math.random();
  let acc = 0;
  const entries = Object.entries(weights);
  for (const [key, w] of entries) {
    acc += w;
    if (r <= acc) return key;
  }
  return entries[entries.length - 1][0];
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// Uniform random timestamp between two ISO dates (inclusive-ish).
export function randomTimeBetween(fromIso, toIso) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const t = from + Math.random() * Math.max(to - from, 0);
  return new Date(t).toISOString();
}

export function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

export const GRADE_COMMENTS = ["Молодец!", "Хорошо", "Можно лучше", "Отличная работа", "Нужно повторить тему", "Разберём на следующем уроке"];

export const HOMEWORK_SUBMISSION_TEXTS = [
  "Решил задачу, приложил файл",
  "Готово",
  "Выполнил все пункты",
  "Есть вопрос по третьему заданию, но в целом сделал",
];

export const HOMEWORK_TEACHER_COMMENTS = ["Отлично!", "Хорошо", "Есть недочёты", "Молодец"];

// emptyProb-chance of "", else a random pick from list — exact probability, not
// approximated via array padding.
export function maybeComment(list, emptyProb) {
  return Math.random() < emptyProb ? "" : pick(list);
}

export async function log(msg) {
  console.log(msg);
}

export function countLabel(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
