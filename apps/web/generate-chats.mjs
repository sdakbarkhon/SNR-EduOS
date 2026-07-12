#!/usr/bin/env node
/**
 * Промт 7.2 Часть 5 — наполнение личных (student↔teacher) и групповых
 * чатов реалистичными сообщениями через Gemini (бесплатный тир).
 *
 * Отличие от generate-weekend.mjs: там писали ОДИН teacher_karim в СВОИ
 * уроки (RLS через anon key + сессию одного пользователя достаточна).
 * Здесь сообщения нужно вставлять от РАЗНЫХ отправителей (то ученик, то
 * учитель, то куратор, то другой ученик группового чата) — одна RLS-сессия
 * не может писать sender_id чужого пользователя (chat_messages INSERT
 * policy требует sender_id = auth.uid()). Поэтому используем
 * SUPABASE_SERVICE_ROLE_KEY (bypass RLS), а не anon key.
 *
 * Локальный одноразовый скрипт (не часть приложения, не деплоится).
 */
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnvLocal();

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const SCRATCHPAD = "C:/Users/toiro/AppData/Local/Temp/claude/I--SNR-EduOS--claude-worktrees-prompt-3-demo-session-logic-456952/44f759f7-b423-4831-bf3f-a470f50c2ae4/scratchpad";
const LOG_PATH = path.join(SCRATCHPAD, "chats-progress-log.json");

// ── Gemini plumbing (same pattern as generate-weekend.mjs) ──
const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
const MIN_INTERVAL_MS = 4200; // 60_000/15 = 4000, + margin (free tier: 15 req/min)
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

let modelName = null;
async function pickWorkingModel() {
  for (const candidate of MODEL_CANDIDATES) {
    try {
      await throttle();
      const model = genAI.getGenerativeModel({ model: candidate });
      await model.generateContent("ping");
      modelName = candidate;
      console.log(`Using Gemini model: ${modelName}`);
      return true;
    } catch (e) {
      const isDailyLimit = /quota|429/i.test(e.message ?? "") && /PerDay/i.test(e.message ?? "");
      console.warn(`  model ${candidate} unavailable: ${e.message.split("\n")[0]}`);
      if (isDailyLimit) console.warn(`  (daily free-tier quota for ${candidate} appears exhausted)`);
    }
  }
  return false;
}

async function callGeminiWithRetry(systemInstruction, userPrompt) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: { responseMimeType: "application/json" },
  });
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await throttle();
    try {
      const result = await model.generateContent(userPrompt);
      return result.response;
    } catch (e) {
      const is429 = e.status === 429 || /429|rate.?limit|quota/i.test(e.message ?? "");
      if (is429 && attempt < MAX_RETRIES - 1) {
        const delay = 5000 * 2 ** attempt;
        console.warn(`  [retry] rate limited, waiting ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Exhausted retries");
}

function stripFences(text) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

function randomTimestampsInLastDays(count, days) {
  const now = Date.now();
  const stamps = [];
  for (let i = 0; i < count; i++) stamps.push(now - Math.random() * days * 86400000);
  stamps.sort((a, b) => a - b);
  return stamps.map((t) => new Date(t).toISOString());
}

// ── progress log (resumable, crash-safe per-thread) ──
function loadLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
  } catch {
    return { done: {}, results: [] };
  }
}
function saveLog(log) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// ── prompts ──
const DIRECT_SYSTEM_PROMPT = `Ты помогаешь сгенерировать реалистичную переписку в мессенджере школьного портала между учеником и учителем (или куратором класса).
Стиль: живой, короткий, разговорный, без канцеляризмов. Ученик — школьник, пишет как школьник (может быть небольшая неформальность), но вежливо. Учитель отвечает по-деловому, тепло, конкретно.
Верни СТРОГО JSON вида {"messages": [{"sender": "student"|"teacher", "body": "текст сообщения"}, ...]}.
Ровно один диалог из 3-8 сообщений. Структура: ученик спрашивает про домашку/тему урока -> учитель отвечает -> ученик уточняет -> учитель поясняет -> (иногда, не всегда) ученик благодарит. Сообщения короткие (1-3 предложения), реалистичные для чата, НЕ используй markdown/списки внутри body.`;

const GROUP_SYSTEM_PROMPT = `Ты помогаешь сгенерировать реалистичную переписку в ГРУППОВОМ чате школьного класса (куратор + несколько учеников этого класса).
Стиль: живой, разговорный, короткие сообщения как в реальном чате. Куратор — по-деловому и тепло. Ученики — по-разному (кто-то серьёзно, кто-то с юмором), но без грубости.
Верни СТРОГО JSON вида {"messages": [{"sender": "<имя из списка ниже или \\"curator\\">", "body": "текст"}, ...]}.
Поле sender должно быть ТОЧНО одним из предложенных имён учеников или строкой "curator" — не придумывай новые имена.
15-30 сообщений. Смесь тем: вопросы про расписание, обсуждение домашнего задания, напоминания куратора (дедлайны, организационные вопросы), немного дружеской болтовни (в меру, не больше 20% сообщений). Сообщения короткие (1-2 предложения), НЕ используй markdown внутри body.`;

async function generateDirectMessages(subjectName, groupName, topics, isCurator) {
  const topicsLine = topics.length ? `Реальные темы недавних уроков по предмету "${subjectName}" в классе "${groupName}": ${topics.join("; ")}.` : `Предмет: "${subjectName}", класс "${groupName}".`;
  const roleNote = isCurator ? `Учитель в этой переписке — куратор класса (может обсуждать не только предмет "${subjectName}", но и общие организационные вопросы класса).` : "";
  const prompt = `${topicsLine}\n${roleNote}\nСгенерируй диалог ученик-учитель.`;
  const response = await callGeminiWithRetry(DIRECT_SYSTEM_PROMPT, prompt);
  const parsed = JSON.parse(stripFences(response.text()));
  return parsed.messages ?? [];
}

async function generateGroupMessages(groupName, studentNames, curatorName, subjectTopics) {
  const namesLine = studentNames.join(", ");
  const topicsLine = subjectTopics.length ? `Недавние темы уроков в этом классе: ${subjectTopics.join("; ")}.` : "";
  const prompt = `Класс: "${groupName}". Куратор: "${curatorName}" (используй sender="curator" для его сообщений). Ученики, доступные как отправители: ${namesLine}.\n${topicsLine}\nСгенерируй общий чат класса.`;
  const response = await callGeminiWithRetry(GROUP_SYSTEM_PROMPT, prompt);
  const parsed = JSON.parse(stripFences(response.text()));
  return parsed.messages ?? [];
}

// ── main ──
async function main() {
  const startIndex = parseInt(process.argv[2] ?? "0", 10);
  const count = parseInt(process.argv[3] ?? "9999", 10);

  const modelAvailable = await pickWorkingModel();
  if (!modelAvailable) {
    console.warn("Дневной бесплатный лимит Gemini исчерпан (или ни одна модель недоступна на этом ключе). Прогресс не потерян — 0 сообщений вставлено, ни один тред не помечен done. Повторите запуск позже (после сброса дневной квоты) или с другим GEMINI_API_KEY.");
    process.exit(0);
  }
  const log = loadLog();

  // Существующие сообщения — не трогаем непустые треды (идемпотентность).
  const { data: existingCounts } = await db.from("chat_messages").select("thread_id");
  const threadsWithMessages = new Set((existingCounts ?? []).map((r) => r.thread_id));

  // ── Личные (direct) чаты ──
  const { data: directThreads, error: directErr } = await db
    .from("chat_threads")
    .select("id, student_id, teacher_id")
    .eq("kind", "direct");
  if (directErr) throw directErr;

  const directTasks = [];
  for (const t of directThreads ?? []) {
    if (threadsWithMessages.has(t.id) || log.done[t.id]) continue;

    const [{ data: student }, { data: teacher }] = await Promise.all([
      db.from("students").select("id, user_id, full_name, school_id").eq("id", t.student_id).single(),
      db.from("teachers").select("id, user_id, full_name").eq("id", t.teacher_id).single(),
    ]);
    if (!student || !teacher) continue;

    const { data: sg } = await db.from("student_groups").select("group_id").eq("student_id", t.student_id).limit(1).maybeSingle();
    if (!sg) continue;
    const [{ data: group }, { data: subject }] = await Promise.all([
      db.from("groups").select("id, name, teacher_id").eq("id", sg.group_id).single(),
      db.from("subjects").select("name").eq("group_id", sg.group_id).eq("teacher_id", t.teacher_id).limit(1).maybeSingle(),
    ]);
    const subjectName = subject?.name ?? "школьная программа";
    const isCurator = group?.teacher_id === t.teacher_id;

    const { data: lessons } = await db
      .from("lessons")
      .select("topic")
      .eq("group_id", sg.group_id)
      .eq("status", "completed")
      .not("topic", "is", null)
      .order("starts_at", { ascending: false })
      .limit(4);
    const topics = (lessons ?? []).map((l) => l.topic).filter(Boolean);

    directTasks.push({
      threadId: t.id,
      kind: "direct",
      studentUserId: student.user_id,
      teacherUserId: teacher.user_id,
      schoolId: student.school_id,
      subjectName,
      groupName: group?.name ?? "",
      topics,
      isCurator,
      label: `direct ${student.full_name} <-> ${teacher.full_name} (${subjectName})`,
    });
  }

  // ── Групповые чаты (не "— Родители") ──
  const { data: groupThreads, error: groupErr } = await db
    .from("chat_threads")
    .select("id, group_id, title")
    .eq("kind", "group")
    .not("title", "ilike", "%— Родители");
  if (groupErr) throw groupErr;

  const groupTasks = [];
  for (const t of groupThreads ?? []) {
    if (threadsWithMessages.has(t.id) || log.done[t.id]) continue;
    if (!t.group_id) continue;

    const [{ data: group }, { data: participants }] = await Promise.all([
      db.from("groups").select("id, name, school_id").eq("id", t.group_id).single(),
      db.from("chat_participants").select("user_id, role_in_thread").eq("thread_id", t.id),
    ]);
    if (!group) continue;

    const studentUserIds = (participants ?? []).filter((p) => p.role_in_thread === "student").map((p) => p.user_id);
    const curatorParticipant = (participants ?? []).find((p) => p.role_in_thread === "curator");
    if (studentUserIds.length === 0 || !curatorParticipant) continue;

    const { data: studentRows } = await db.from("students").select("user_id, full_name").in("user_id", studentUserIds);
    const { data: curatorRow } = await db.from("teachers").select("user_id, full_name").eq("user_id", curatorParticipant.user_id).single();

    // До 6 отправителей-учеников для разнообразия реплик (группа может
    // содержать до 30 демо-учеников из пула — берём случайную выборку).
    const pool = [...(studentRows ?? [])];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosenStudents = pool.slice(0, 6);
    const nameToUserId = new Map(chosenStudents.map((s) => [s.full_name, s.user_id]));

    const { data: lessons } = await db
      .from("lessons")
      .select("topic")
      .eq("group_id", t.group_id)
      .eq("status", "completed")
      .not("topic", "is", null)
      .order("starts_at", { ascending: false })
      .limit(6);
    const topics = (lessons ?? []).map((l) => l.topic).filter(Boolean);

    groupTasks.push({
      threadId: t.id,
      kind: "group",
      curatorUserId: curatorRow?.user_id ?? curatorParticipant.user_id,
      curatorName: curatorRow?.full_name ?? "Куратор",
      nameToUserId,
      groupName: group.name,
      schoolId: group.school_id,
      topics,
      label: `group ${group.name} (${chosenStudents.length} students)`,
    });
  }

  const allTasks = [...directTasks, ...groupTasks];
  const batch = allTasks.slice(startIndex, startIndex + count);
  console.log(`Всего к генерации: ${allTasks.length} (direct=${directTasks.length}, group=${groupTasks.length}). В этом запуске: ${batch.length}.`);

  let generated = 0;
  for (const task of batch) {
    console.log(`-> ${task.label}`);
    try {
      if (task.kind === "direct") {
        const msgs = await generateDirectMessages(task.subjectName, task.groupName, task.topics, task.isCurator);
        if (!msgs.length) throw new Error("empty response");
        const stamps = randomTimestampsInLastDays(msgs.length, 14);
        const rows = msgs.map((m, i) => ({
          thread_id: task.threadId,
          sender_id: m.sender === "teacher" ? task.teacherUserId : task.studentUserId,
          body: String(m.body ?? "").slice(0, 2000),
          created_at: stamps[i],
          school_id: task.schoolId,
        }));
        const { error } = await db.from("chat_messages").insert(rows);
        if (error) throw error;
        generated += rows.length;
      } else {
        const msgs = await generateGroupMessages(task.groupName, [...task.nameToUserId.keys()], task.curatorName, task.topics);
        if (!msgs.length) throw new Error("empty response");
        const studentIds = [...task.nameToUserId.values()];
        const stamps = randomTimestampsInLastDays(msgs.length, 14);
        const rows = msgs.map((m, i) => {
          let senderId;
          if (m.sender === "curator") senderId = task.curatorUserId;
          else senderId = task.nameToUserId.get(m.sender) ?? studentIds[i % Math.max(studentIds.length, 1)] ?? task.curatorUserId;
          return {
            thread_id: task.threadId,
            sender_id: senderId,
            body: String(m.body ?? "").slice(0, 2000),
            created_at: stamps[i],
            school_id: task.schoolId,
          };
        });
        const { error } = await db.from("chat_messages").insert(rows);
        if (error) throw error;
        generated += rows.length;
      }
      log.done[task.threadId] = true;
      log.results.push({ threadId: task.threadId, label: task.label, ok: true });
      saveLog(log);
      console.log(`   ok (+${task.kind === "direct" ? "N" : "N"} messages)`);
    } catch (e) {
      console.error(`   !! failed: ${e.message}`);
      log.results.push({ threadId: task.threadId, label: task.label, error: e.message });
      saveLog(log);
    }
  }

  console.log(`Готово. Сообщений вставлено в этом запуске: ${generated}.`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
