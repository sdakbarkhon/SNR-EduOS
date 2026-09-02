"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronUp, ChevronDown, Pencil, Trash2, Check,
  Sparkles, AlertTriangle, CalendarPlus, Loader2,
  Plus, ArrowRight, CalendarRange, Lock,
} from "lucide-react";
import {
  getCurriculumTopicsWithUsage, updateCurriculumPlanTopic,
  reorderCurriculumPlanTopics, deleteCurriculumPlanTopic,
  createCurriculumPlanTopic, enqueueStageGeneration,
  getDictionary, format, tashkentDayKey,
} from "@snr/core";
import type { CurriculumPlanStatus, CurriculumPlanWithTopics, CurriculumTopicWithUsage, Dictionary, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useSchoolNowSnapshot } from "@/components/SchoolTimeProvider";
import { PageContainer } from "@/components/PageContainer";
import { useRealtimeChannel } from "@/lib/realtime";

// 19.08.2026 — слова переехали в словарь, правило склонения не тронуто.
function topicWord(n: number, d: Dictionary["curriculum"]): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return d.topicWordOne;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return d.topicWordFew;
  return d.topicWordMany;
}

/** Ответ /api/lessons/bulk. Тот же роут, что у массового создания уроков —
 *  шаг 1 не заводит своей раскладки, он зовёт готовую. */
type BulkPreview = {
  lessons: Array<{ date: string; time: string; occupied: boolean; topicTitle: string | null }>;
  willCreate: number;
  occupied: number;
};

type GenerateLessonsResult = {
  created: number;
  skipped?: number;
  lessons?: Array<{ topicId: string; title: string; date: string; time: string; lessonId?: string }>;
  /** Урок по теме уже был — роут возвращает его, чтобы кнопка привела к нему. */
  existingLessonId?: string | null;
  message?: string;
  error?: string;
};

export function CurriculumPlanDetailView({
  plan,
  teacherId,
}: {
  plan: CurriculumPlanWithTopics;
  teacherId: string;
}) {
  // Z.3, заход 3 — школьное «сейчас» для обработчика создания урока.
  const schoolNowMs = useSchoolNowSnapshot();
  const db = createClient();
  const isOwner = plan.teacher_id === teacherId;
  const { locale } = useLocale();
  const router = useRouter();
  const tt = getDictionary(locale as Locale).teacher;
  const tc = getDictionary(locale as Locale).curriculum;

  /** Подписи дней недели — те же, что в окне массового создания уроков. */
  const wdLabel: Record<number, string> = {
    1: tt.wdMon, 2: tt.wdTue, 3: tt.wdWed, 4: tt.wdThu, 5: tt.wdFri, 6: tt.wdSat, 7: tt.wdSun,
  };

  // Большой фикс, Блок 6, ЗАДАЧА 1 — фоновый парсинг: пока status='processing'
  // тем ещё нет (background-parse дописывает их асинхронно), поэтому текущий
  // статус/прогресс/ошибка живут локально и обновляются через Realtime, а не
  // через plan-проп (тот приходит один раз с сервера при первой загрузке
  // страницы).
  const [planStatus, setPlanStatus] = useState<CurriculumPlanStatus>(plan.status);
  const [progressPercent, setProgressPercent] = useState(plan.progress_percent);
  const [errorMessage, setErrorMessage] = useState(plan.error_message);
  const [retrying, setRetrying] = useState(false);
  // Настоящая стадия работы, а не только процент. Проценты расставлены по коду
  // приметами; стадия говорит, чем сервер занят прямо сейчас — при разборе
  // тридцатимегабайтного учебника это разница между «работает» и «зависло».
  const [progressStage, setProgressStage] = useState<string | null>(
    (plan as { progress_stage?: string | null }).progress_stage ?? null,
  );
  const [confirming, setConfirming] = useState<"accept" | "reject" | null>(null);

  useRealtimeChannel(
    planStatus === "ready" || planStatus === "preview" ? null : `curriculum-plan-${plan.id}`,
    "curriculum_plans",
    `id=eq.${plan.id}`,
    (payload) => {
      const row = payload.new as { status?: string; progress_percent?: number; error_message?: string | null; progress_stage?: string | null };
      if (typeof row.progress_percent === "number") setProgressPercent(row.progress_percent);
      if (row.status === "processing" || row.status === "preview" || row.status === "ready" || row.status === "error") setPlanStatus(row.status);
      if ("error_message" in row) setErrorMessage(row.error_message ?? null);
      if ("progress_stage" in row) setProgressStage(row.progress_stage ?? null);
    },
  );

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/curriculum-plans/${plan.id}/retry-parse`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setErrorMessage(json.error || tc.retryFailed); return; }
      setPlanStatus("processing");
      setProgressPercent(10);
      setErrorMessage(null);
    } catch {
      setErrorMessage(tc.networkError);
    } finally {
      setRetrying(false);
    }
  }

  // Первый рендер идёт с сервера, где связей с уроками ещё не считали, —
  // отсюда нули и пустые ссылки. Настоящие значения подставит эффект ниже,
  // до этого момента кнопки скрыты флагом usageLoaded.
  const [topics, setTopics] = useState<CurriculumTopicWithUsage[]>(
    plan.topics.map((t) => ({ ...t, used_in_lessons: 0, lesson_id: null, lesson_starts_at: null, lessons: [] })),
  );
  const [usageLoaded, setUsageLoaded] = useState(false);

  useEffect(() => {
    if (planStatus !== "ready" && planStatus !== "preview") return;
    let cancelled = false;
    getCurriculumTopicsWithUsage(db, plan.id)
      .then((withUsage) => { if (!cancelled) { setTopics(withUsage); setUsageLoaded(true); } })
      .catch(() => { if (!cancelled) setUsageLoaded(true); });
    return () => { cancelled = true; };
    // planStatus добавлен в deps намеренно — как только фоновый парсинг
    // переводит план в 'ready' (Realtime выше), темы ещё не в исходном
    // серверном plan-пропе (он был загружен, пока план был 'processing'),
    // поэтому нужен свежий фетч именно в этот момент, а не только при mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, planStatus]);

  // ── Rename (inline) ──────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function startEdit(t: CurriculumPlanWithTopics["topics"][number]) {
    setEditingId(t.id);
    setEditValue(t.title);
    setRowError(null);
  }
  async function commitEdit(topicId: string) {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed) return;
    const prev = topics;
    setTopics((cur) => cur.map((t) => (t.id === topicId ? { ...t, title: trimmed } : t)));
    try {
      await updateCurriculumPlanTopic(db, topicId, { title: trimmed });
    } catch (e) {
      setTopics(prev);
      setRowError({ id: topicId, message: e instanceof Error ? e.message : tc.renameFailed });
    }
  }

  // ── Reorder ───────────────────────────────────────────────────────────────
  const [reordering, setReordering] = useState(false);
  async function moveTopic(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= topics.length || reordering) return;
    const prev = topics;
    const next = [...topics];
    const a = next[index]!, b = next[newIndex]!;
    next[index] = b; next[newIndex] = a;
    setTopics(next);
    setReordering(true);
    try {
      await reorderCurriculumPlanTopics(db, next.map((t) => t.id));
    } catch (e) {
      setTopics(prev);
      setRowError({ id: a.id, message: e instanceof Error ? e.message : tc.reorderFailed });
    } finally {
      setReordering(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<CurriculumTopicWithUsage | null>(null);
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCurriculumPlanTopic(db, confirmDelete.id);
      setTopics((cur) => cur.filter((t) => t.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      setRowError({ id: confirmDelete.id, message: e instanceof Error ? e.message : tc.deleteTopicFailed });
    } finally {
      setDeleting(false);
    }
  }

  // ═══ ШАГ 1. СОЗДАТЬ УРОКИ ════════════════════════════════════════════════
  //
  // ЗОВЁТ ТОТ ЖЕ РОУТ, ЧТО И МАССОВОЕ СОЗДАНИЕ УРОКОВ — /api/lessons/bulk.
  // Правило «эти дни недели, это время, с такого числа» уже написано там и в
  // lib/curriculum-lesson-planner.ts; завести рядом второе значило бы завести
  // второй способ раскладки, который через месяц разойдётся с первым. Отличие
  // ровно одно: сюда идёт onlyWithTopic — уроков столько, сколько свободных
  // тем, и ни одного лишнего.
  //
  // Период считаем сами: заказчик просит дату НАЧАЛА, конца не просит. Берём
  // с запасом в четыре недели сверх нужного — лишние дни отсеются вместе с
  // уроками без темы, их отбрасывает сам роут.
  const freeTopics = topics.filter((t) => t.used_in_lessons === 0);

  const [startDate, setStartDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("09:00");
  const [perDay, setPerDay] = useState(false);
  const [timeByWeekday, setTimeByWeekday] = useState<Record<number, string>>({});
  const timeOf = (n: number) => timeByWeekday[n] ?? time;

  const [step1Busy, setStep1Busy] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Preview, setStep1Preview] = useState<BulkPreview | null>(null);
  const [step1Done, setStep1Done] = useState<number | null>(null);

  // Умолчание даты — школьное ЗАВТРА (пункт 13). Не «сегодня»: если школьное
  // сейчас уже за полдень, утренние слоты сегодня в прошлом, а создание урока
  // прошлое отвергает — умолчание врало бы. Ставится один раз, дальше дата
  // принадлежит человеку.
  useEffect(() => {
    setStartDate((cur) => cur || tashkentDayKey(schoolNowMs() + 24 * 60 * 60 * 1000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWeekday(n: number) {
    setStep1Preview(null);
    setWeekdays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));
    // Сняли день — забываем его время, чтобы снятый день не «оживал» не тем
    // значением. Тот же приём, что в окне массового создания.
    setTimeByWeekday((cur) => {
      if (!(n in cur)) return cur;
      const копия = { ...cur };
      delete копия[n];
      return копия;
    });
  }

  /** «2026-09-03» + N дней → «2026-10-01». Счёт по UTC: у календарной даты
   *  часового пояса нет, и прибавление суток от него не зависит. */
  function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  async function runStep1(isPreview: boolean) {
    setStep1Error(null);
    if (weekdays.length === 0) { setStep1Error(tt.bulkPickWeekday); return; }
    if (!startDate) { setStep1Error(tt.bulkBadPeriod); return; }
    if (freeTopics.length === 0) { setStep1Error(tc.step1NoTopics); return; }
    setStep1Busy(true);
    try {
      const недель = Math.ceil(freeTopics.length / weekdays.length) + 4;
      const res = await fetch("/api/lessons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: plan.group_id,
          subjectId: plan.subject_id,
          weekdays, time, from: startDate, to: addDays(startDate, недель * 7),
          timeByWeekday: perDay
            ? Object.fromEntries(weekdays.map((n) => [String(n), timeOf(n)]))
            : undefined,
          useTopics: true,
          onlyWithTopic: true,
          preview: isPreview,
        }),
      });
      const json = await res.json();
      // Отказ базы доезжает до человека своим текстом: «Нельзя создать урок в
      // прошедшее время» роут отдаёт по-русски, сырой ошибки здесь не бывает.
      if (!res.ok) { setStep1Error(json.error || tc.createLessonFailed); return; }
      if (isPreview) setStep1Preview(json as BulkPreview);
      else {
        setStep1Done(json.created as number);
        setStep1Preview(null);
        const fresh = await getCurriculumTopicsWithUsage(db, plan.id).catch(() => null);
        if (fresh) setTopics(fresh);
      }
    } catch {
      setStep1Error(tc.networkError);
    } finally {
      setStep1Busy(false);
    }
  }

  // ═══ ШАГ 2. НАПОЛНИТЬ ЧЕРЕЗ ИИ ═══════════════════════════════════════════
  //
  // В ЭТОМ ЗАХОДЕ ШАГ НЕ НАПОЛНЯЕТ. Он показывает, где пусто, и ведёт в урок,
  // где наполнение уже работает поштучно. Ни рубля на модель и ни строчки
  // нового кода ИИ: наполнение нескольких уроков сразу упирается в фоновую
  // очередь (один вызов модели — до пяти минут), и это отдельная работа.
  //
  // «Пусто» — отсутствие этапов роли middle, а не отсутствие этапов вовсе:
  // «Старт» и «Итог» кладёт каждому уроку триггер. Признак приходит вместе с
  // темами, из getCurriculumTopicsWithUsage, — второго запроса за ним нет.
  const planLessons = topics.flatMap((t) =>
    t.lessons.map((l) => ({ ...l, topicTitle: t.title })),
  ).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const emptyLessons = planLessons.filter((l) => !l.has_content).length;

  // Сводка по последней пачке. Считается по batch_id самого свежего заказа:
  // «заказано 20, сделано 0» — ровно то, что человек хочет увидеть,
  // вернувшись.
  const свежийЗаказ = planLessons
    .map((l) => l.queue)
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .sort((a, b) => b.enqueued_at.localeCompare(a.enqueued_at))[0] ?? null;
  const пачка = свежийЗаказ
    ? planLessons.filter((l) => l.queue?.batch_id === свежийЗаказ.batch_id)
    : [];
  const пачкаСводка = {
    queued: пачка.length,
    done: пачка.filter((l) => l.queue?.status === "done").length,
    failed: пачка.filter((l) => l.queue?.status === "failed").length,
  };

  const [pickedLessons, setPickedLessons] = useState<Set<string>>(new Set());
  // ═══ РАЗБОР ОЧЕРЕДИ (заход Q2) ═══════════════════════════════════════════
  //
  // ОДНО НАЖАТИЕ — ОДИН УРОК. Генерация идёт до пяти минут при потолке функции
  // в 300 секунд; два урока в один заход не влезают, а обрыв посреди вставки
  // оставил бы урок с половиной этапов. Пачку набирает человек повторными
  // нажатиями — либо дожидается расписания (заход Q3).
  //
  // Крутить цикл за него мы НЕ будем: каждый круг стоит денег, и решать,
  // сколько их потратить, должен человек, а не наш `for`.
  const [drainBusy, setDrainBusy] = useState(false);
  const [drainMsg, setDrainMsg] = useState<string | null>(null);
  const [drainError, setDrainError] = useState<string | null>(null);

  async function handleDrain() {
    setDrainBusy(true);
    setDrainMsg(null);
    setDrainError(null);
    try {
      const res = await fetch(`/api/curriculum-plans/${plan.id}/process-stage-queue`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setDrainError(json.error || tc.networkError); return; }
      if (json.kind === "empty") setDrainMsg(tc.step2DrainEmpty);
      else if (json.kind === "done") {
        setDrainMsg(format(tc.step2DrainDone, {
          inserted: json.inserted, removed: json.removed, remaining: json.remaining,
        }));
      } else {
        // Отказ доезжает до человека своим текстом, а не молчанием.
        setDrainError(format(tc.step2DrainFailed, { reason: String(json.reason ?? "") }));
      }
      // Перечитываем темы: у урока изменились этапы и состояние в очереди.
      const fresh = await getCurriculumTopicsWithUsage(db, plan.id).catch(() => null);
      if (fresh) setTopics(fresh);
    } catch {
      setDrainError(tc.networkError);
    } finally {
      setDrainBusy(false);
    }
  }

  const [enqueueBusy, setEnqueueBusy] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const [enqueueDone, setEnqueueDone] = useState<{ queued: number; skipped: number } | null>(null);
  const [confirmRefill, setConfirmRefill] = useState(false);

  function toggleLesson(id: string) {
    setEnqueueError(null);
    setEnqueueDone(null);
    setPickedLessons((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const выбранные = planLessons.filter((l) => pickedLessons.has(l.id));
  const выбранныеНаполненные = выбранные.filter((l) => l.has_content).length;

  /** Спрашиваем ПЕРЕД заказом, если среди выбранных есть уже наполненные:
   *  решение заказчика — не пропускать молча и не перетирать молча. Само
   *  стирание этапов делает разборщик (заход Q2), здесь только вопрос. */
  function askEnqueue() {
    if (pickedLessons.size === 0) { setEnqueueError(tc.step2PickFirst); return; }
    setEnqueueError(null);
    setConfirmRefill(true);
  }

  async function handleEnqueue() {
    setEnqueueBusy(true);
    setEnqueueError(null);
    try {
      const res = await enqueueStageGeneration(db, [...pickedLessons]);
      setEnqueueDone({ queued: res.queued, skipped: res.skipped });
      setPickedLessons(new Set());
      setConfirmRefill(false);
      // Перечитываем: состояние очереди приезжает вместе с темами, и после
      // заказа строки должны появиться на экране сразу.
      const fresh = await getCurriculumTopicsWithUsage(db, plan.id).catch(() => null);
      if (fresh) setTopics(fresh);
    } catch (e) {
      // Молчать нельзя: заказ либо прошёл, либо нет, и человек должен знать.
      setEnqueueError(e instanceof Error ? e.message : tc.networkError);
    } finally {
      setEnqueueBusy(false);
    }
  }

  // ═══ ШАГ 3. УДАЛИТЬ ТЕМЫ ═════════════════════════════════════════════════
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  function togglePick(id: string) {
    setBulkDeleteError(null);
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pickedTopics = topics.filter((t) => picked.has(t.id));
  const pickedLessonCount = pickedTopics.reduce((n, t) => n + t.used_in_lessons, 0);

  function askBulkDelete() {
    // Пустой выбор — не молчаливое ничего, а внятный текст.
    if (picked.size === 0) { setBulkDeleteError(tc.step3PickFirst); return; }
    setBulkDeleteError(null);
    setConfirmBulkDelete(true);
  }

  /**
   * Удаление пачкой. Каждая тема — свой запрос, поэтому отказ на одной не
   * отменяет остальные: тот же приём, что у массовой отметки 02.09.2026.
   *
   * УРОКИ НЕ УДАЛЯЮТСЯ И УДАЛЕНЫ БЫТЬ НЕ МОГУТ. Внешний ключ
   * lessons.curriculum_topic_id объявлен ON DELETE SET NULL: уроки остаются в
   * расписании, но теряют связь с планом. Ровно это и написано в
   * подтверждении — числом, а не намёком.
   */
  async function handleBulkDelete() {
    const цели = pickedTopics;
    if (цели.length === 0) return;
    setBulkDeleting(true);
    setBulkDeleteError(null);
    const итоги = await Promise.allSettled(цели.map((t) => deleteCurriculumPlanTopic(db, t.id)));
    const прошли = цели.filter((_, i) => итоги[i]!.status === "fulfilled");
    const ушли = new Set(прошли.map((t) => t.id));
    setTopics((cur) => cur.filter((t) => !ушли.has(t.id)));
    setPicked((cur) => new Set([...cur].filter((id) => !ушли.has(id))));
    const упали = итоги.length - прошли.length;
    if (упали > 0) {
      // Молчать нельзя: часть тем осталась, и человек должен это увидеть.
      const первая = итоги.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      console.error("[curriculum] часть тем не удалилась:", первая?.reason);
      setBulkDeleteError(format(tc.step3Partial, { ok: прошли.length, all: итоги.length }));
    } else {
      setConfirmBulkDelete(false);
    }
    setBulkDeleting(false);
  }

  /** Согласие с предложенными темами — или отказ от черновика. */
  async function confirmPlan(accept: boolean) {
    setConfirming(accept ? "accept" : "reject");
    try {
      const res = await fetch(`/api/curriculum-plans/${plan.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMessage(json.error || tc.confirmFailed); return; }
      if (json.deleted) router.push("/teacher/curriculum");
      else setPlanStatus("ready");
    } catch {
      setErrorMessage(tc.networkError);
    } finally {
      setConfirming(null);
    }
  }

  // ── Кнопка «Создать урок» рядом с темой ─────────────────────────────────
  //
  // Идёт в ТОТ ЖЕ роут, что и «создать все автоматически», только с одной
  // темой в теле. Значит место в расписании подбирается теми же правилами
  // (1 августа 2026, 09:00, шаг 55 минут, свободный слот группы), а группа и
  // предмет берутся из плана — спрашивать их не у кого и незачем.
  //
  // Дата и время НЕ спрашиваются: у темы плана нет своего времени, а
  // придумывать его руками ради каждой темы — ровно та работа, от которой
  // кнопка избавляет. Что получилось, показывается тут же строкой «Урок 3
  // августа в 09:00», и урок открывается ссылкой.
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [createError, setCreateError] = useState<{ id: string; message: string } | null>(null);

  async function handleCreateLessonForTopic(t: CurriculumTopicWithUsage) {
    if (creatingFor) return;
    setCreatingFor(t.id);
    setCreateError(null);
    try {
      const res = await fetch(`/api/curriculum-plans/${plan.id}/generate-lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Дата — та же, что выбрана в шаге 1: жёсткой «первого августа» в
        // планировщике больше нет (пункт 13), и подсовывать сюда другую было
        // бы вторым источником даты на одной странице.
        body: JSON.stringify({ topicId: t.id, startDate }),
      });
      const json = (await res.json()) as GenerateLessonsResult;
      if (!res.ok) {
        setCreateError({ id: t.id, message: json.error || tc.createLessonFailed });
        return;
      }
      // Перечитываем темы, а не дорисовываем счётчик в состоянии: ссылка на
      // урок и его время приходят из базы, и придумывать их на клиенте
      // значило бы показать не то, что записано.
      const fresh = await getCurriculumTopicsWithUsage(db, plan.id).catch(() => null);
      if (fresh) setTopics(fresh);
    } catch {
      setCreateError({ id: t.id, message: tc.networkError });
    } finally {
      setCreatingFor(null);
    }
  }

  // ── Кнопка «Добавить тему» ──────────────────────────────────────────────
  const [adding, setAdding] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAddTopic() {
    const title = addTitle.trim();
    if (!title) { setAddError(tt.curAddTopicEmpty); return; }
    setAddBusy(true);
    setAddError(null);
    try {
      const created = await createCurriculumPlanTopic(db, {
        planId: plan.id,
        title,
        description: addDescription.trim() || null,
      });
      // Своя тема ведёт себя как любая другая: у неё нет уроков, поэтому
      // used_in_lessons = 0 — и кнопка «Создать урок» у неё сразу активна.
      setTopics((cur) => [...cur, { ...created, used_in_lessons: 0, lesson_id: null, lesson_starts_at: null, lessons: [] }]);
      setAddTitle("");
      setAddDescription("");
      setAdding(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : tt.curAddTopicFailed);
    } finally {
      setAddBusy(false);
    }
  }

  /** «2026-08-03T09:00:00+05:00» → дата и время по-ташкентски, как их увидит
   *  группа. toLocaleString с часовым поясом, а не срез строки: сервер может
   *  вернуть время в UTC. */
  function lessonWhen(iso: string): { date: string; time: string } {
    const dt = new Date(iso);
    const opts = { timeZone: "Asia/Tashkent" } as const;
    return {
      date: dt.toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU", { ...opts, day: "numeric", month: "long" }),
      time: dt.toLocaleTimeString(locale === "en" ? "en-GB" : "ru-RU", { ...opts, hour: "2-digit", minute: "2-digit" }),
    };
  }

  const inputCls = "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <PageContainer className="space-y-6">
      <div>
        <Link href="/teacher/curriculum" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-3.5 w-3.5" /> {tc.title}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{plan.subject_name}</p>
            <h1 className="mt-0.5 text-xl font-bold text-slate-900">{plan.group_name}</h1>
            {(planStatus === "ready" || planStatus === "preview") && (
              <p className="mt-1 text-sm text-slate-500">{topics.length} {topicWord(topics.length, tc)}</p>
            )}
          </div>
        </div>
      </div>

      {planStatus === "processing" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-8 text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm font-semibold text-slate-700">
            {progressStage
              ? ({ queued: tc.stageQueued, download: tc.stageDownload, extract: tc.stageExtract,
                   outline: tc.stageOutline, model: tc.stageModel, save: tc.stageSave } as Record<string, string>)[progressStage]
                ?? tc.processingTitle
              : tc.processingTitle}
          </p>
          <p className="mt-1 text-xs text-slate-400">{tc.processingHint}</p>
          <div className="mx-auto mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-blue-600">{progressPercent}%</p>
        </div>
      )}

      {planStatus === "error" && (
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="text-sm font-bold text-red-700">{tc.errorTitle}</p>
          {errorMessage && <p className="mx-auto mt-1 max-w-md text-xs text-red-500">{errorMessage}</p>}
          {isOwner && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {retrying ? tc.retrying : tc.retry}
            </button>
          )}
        </div>
      )}

      {(planStatus === "ready" || planStatus === "preview") && (
      <>
      {/* Предпросмотр: темы предложены, плана ещё нет. Панель стоит НАД
          списком — учитель должен понимать, что смотрит черновик, прежде чем
          начнёт его править. */}
      {planStatus === "preview" && isOwner && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <p className="text-sm font-bold text-slate-900">{tc.previewTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{tc.previewHint}</p>
          <p className="mt-1.5 text-xs font-semibold text-blue-700">
            {tc.previewTopicCount.replace("{n}", String(topics.length))}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => confirmPlan(true)}
              disabled={confirming !== null}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {confirming === "accept" ? tc.previewAccepting : tc.previewAccept}
            </button>
            <button
              onClick={() => { if (window.confirm(tc.previewRejectConfirm)) confirmPlan(false); }}
              disabled={confirming !== null}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {confirming === "reject" ? tc.previewRejecting : tc.previewReject}
            </button>
          </div>
        </div>
      )}

      {!isOwner && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {tc.readOnlyOtherTeacher}
        </div>
      )}

      {/* ═══ ТРИ ШАГА ПО ПОРЯДКУ ═════════════════════════════════════════
          02.09.2026, пункты 13 и 14. Раньше три кнопки лежали ВНИЗУ, после
          всего списка тем, и были равноправны: «создать все», «по одной»,
          «как шаблоны». Порядка в них не читалось, а «как шаблоны» вообще
          уводила со страницы в форму урока. Теперь это три шага, по порядку,
          наверху — до списка тем, потому что с них работа и начинается. */}
      {isOwner && (
        <div className="space-y-3">
          {/* ── ШАГ 1 ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">1</span>
              <h2 className="text-sm font-bold text-slate-900">{tc.step1Title}</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{tc.step1Hint}</p>

            {freeTopics.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
                {tc.step1NoTopics}
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tc.step1From}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setStep1Preview(null); }}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tt.bulkTime}</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => { setTime(e.target.value); setStep1Preview(null); }}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{tt.bulkWeekdays}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                      const on = weekdays.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleWeekday(n)}
                          className={`h-9 w-11 rounded-lg text-xs font-bold transition-colors ${
                            on ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {wdLabel[n]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Своё время по дням — то же самое, что в окне массового
                    создания уроков: одна галка, поля появляются только на
                    выбранные дни. Не тронул — все дни идут в общее время. */}
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <label className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={perDay}
                      onChange={(e) => {
                        setPerDay(e.target.checked);
                        setStep1Preview(null);
                        if (e.target.checked) {
                          setTimeByWeekday(Object.fromEntries(weekdays.map((n) => [n, timeOf(n)])));
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {tt.bulkPerDayTime}
                      <span className="mt-0.5 block text-[11px] text-gray-400">
                        {perDay ? tt.bulkPerDayTimeHint : tt.bulkTimeSame}
                      </span>
                    </span>
                  </label>
                  {perDay && weekdays.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[...weekdays].sort((a, b) => a - b).map((n) => (
                        <label key={n} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
                          <span className="w-8 shrink-0 text-[11px] font-bold uppercase text-gray-400">{wdLabel[n]}</span>
                          <input
                            type="time"
                            value={timeOf(n)}
                            onChange={(e) => { setTimeByWeekday((cur) => ({ ...cur, [n]: e.target.value })); setStep1Preview(null); }}
                            className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {step1Error && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {step1Error}
                  </p>
                )}

                {step1Done !== null && (
                  <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
                    <Check className="h-4 w-4" /> {format(tc.step1Done, { n: step1Done })}
                  </p>
                )}

                {/* Предпросмотр — тот же, что у массового создания: сначала
                    показываем, что получится, и только потом создаём. */}
                {step1Preview && (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">{tt.bulkPreviewTitle}</p>
                    <p className="text-sm font-semibold text-gray-700">
                      {tt.bulkWillCreate.replace("{n}", String(step1Preview.willCreate))}
                    </p>
                    {step1Preview.occupied > 0 && (
                      <p className="text-sm text-gray-700">{tt.bulkOccupied.replace("{n}", String(step1Preview.occupied))}</p>
                    )}
                    {step1Preview.lessons.length === 0 ? (
                      <p className="mt-1.5 text-sm text-gray-500">{tt.bulkNothing}</p>
                    ) : (
                      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-blue-100 bg-white">
                        <table className="w-full text-xs">
                          <tbody className="divide-y divide-gray-50">
                            {step1Preview.lessons.map((l, k) => (
                              <tr key={`${l.date}-${k}`} className={l.occupied ? "text-gray-400" : "text-gray-700"}>
                                <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold">{l.date}</td>
                                <td className="whitespace-nowrap px-2.5 py-1.5">{l.time}</td>
                                <td className="px-2.5 py-1.5">
                                  {l.occupied ? <span className="italic">{tt.bulkOccupiedRow}</span> : l.topicTitle}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {step1Preview ? (
                    <>
                      <button
                        onClick={() => setStep1Preview(null)}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        {tt.bulkBack}
                      </button>
                      <button
                        onClick={() => runStep1(false)}
                        disabled={step1Busy || step1Preview.willCreate === 0}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {step1Busy ? tt.bulkCreating : tt.bulkCreateBtn}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => runStep1(true)}
                      disabled={step1Busy}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      <CalendarRange className="h-4 w-4" />
                      {step1Busy ? tt.bulkPreviewLoading : tt.bulkPreviewBtn}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── ШАГ 2 ─────────────────────────────────────────────────── */}
          <div className={`rounded-2xl border p-5 shadow-sm ${planLessons.length === 0 ? "border-slate-100 bg-slate-50/60" : "border-violet-100 bg-white"}`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${planLessons.length === 0 ? "bg-slate-300" : "bg-violet-600"}`}>2</span>
              <h2 className="text-sm font-bold text-slate-900">{tc.step2Title}</h2>
              {planLessons.length === 0 && <Lock className="h-3.5 w-3.5 text-slate-400" />}
            </div>

            {planLessons.length === 0 ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{tc.step2Locked}</p>
            ) : (
              <>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{tc.step2Hint}</p>
                <p className="mt-2 text-xs font-bold text-violet-700">
                  {format(tc.step2Counts, { empty: emptyLessons, all: planLessons.length })}
                </p>

                {/* Сводка по последнему заказу. Появляется, только если заказ
                    был: пустая строка «заказано 0» ничего не объясняет. */}
                {свежийЗаказ && (
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {format(tc.step2BatchLine, пачкаСводка)}
                  </p>
                )}

                {/* Разбор очереди. Кнопка появляется, только когда есть что
                    разбирать: предлагать нажать «наполнить» при пустой очереди
                    значит предлагать потратить деньги впустую. */}
                {пачкаСводка.queued > пачкаСводка.done + пачкаСводка.failed && (
                  <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
                    <button
                      onClick={handleDrain}
                      disabled={drainBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {drainBusy
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Sparkles className="h-4 w-4" />}
                      {drainBusy ? tc.step2Draining : tc.step2Drain}
                    </button>
                    <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{tc.step2DrainHint}</p>
                  </div>
                )}

                {drainMsg && (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] leading-snug text-emerald-800">
                    {drainMsg}
                  </p>
                )}
                {drainError && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {drainError}
                  </p>
                )}

                {enqueueError && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {enqueueError}
                  </p>
                )}
                {enqueueDone && (
                  <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                    {format(tc.step2Enqueued, { n: enqueueDone.queued })}
                    {enqueueDone.skipped > 0 && (
                      <span className="mt-0.5 block font-normal text-amber-700">
                        {format(tc.step2Skipped, { n: enqueueDone.skipped })}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-2.5 max-h-64 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
                  {planLessons.map((l) => {
                    // Третье состояние рядом с «пусто / наполнен»: заказ важнее
                    // наполненности, потому что рассказывает, что происходит
                    // прямо сейчас.
                    const q = l.queue;
                    const метка = q && q.status === "queued" ? { text: tc.step2Queued, cls: "bg-sky-100 text-sky-700" }
                      : q && q.status === "running" ? { text: tc.step2Running, cls: "bg-violet-100 text-violet-700" }
                      : q && q.status === "failed" ? { text: tc.step2Failed, cls: "bg-red-100 text-red-700" }
                      : l.has_content ? { text: tc.step2Filled, cls: "bg-emerald-100 text-emerald-700" }
                      : { text: tc.step2Empty, cls: "bg-amber-100 text-amber-700" };
                    return (
                      <div
                        key={l.id}
                        className={`flex items-center gap-2.5 px-3 py-2 ${pickedLessons.has(l.id) ? "bg-violet-50/50" : ""}`}
                      >
                        {/* Галочка есть и у наполненного: заказчик решил
                            спрашивать про перезаполнение, а не запрещать его. */}
                        <input
                          type="checkbox"
                          checked={pickedLessons.has(l.id)}
                          onChange={() => toggleLesson(l.id)}
                          disabled={q?.status === "running"}
                          className="h-4 w-4 shrink-0 rounded border-gray-300 text-violet-600 focus:ring-violet-400 disabled:opacity-40"
                        />
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${метка.cls}`}>
                          {метка.text}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{l.topicTitle}</span>
                        {q?.status === "failed" && q.last_error && (
                          <span className="shrink-0 truncate text-[10px] text-red-500" title={q.last_error}>
                            {q.last_error.slice(0, 40)}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {lessonWhen(l.starts_at).date}, {lessonWhen(l.starts_at).time}
                        </span>
                        <Link
                          href={`/teacher/lessons/${l.id}`}
                          className="flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-100"
                        >
                          <Sparkles className="h-3 w-3" /> {tc.step2Open}
                        </Link>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPickedLessons(new Set(planLessons.filter((l) => l.queue?.status !== "running").map((l) => l.id)))}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    {tc.step3SelectAll}
                  </button>
                  <button
                    onClick={() => { setPickedLessons(new Set()); setEnqueueError(null); }}
                    disabled={pickedLessons.size === 0}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >
                    {tc.step3ClearAll}
                  </button>
                  <button
                    onClick={askEnqueue}
                    disabled={enqueueBusy}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {enqueueBusy ? tc.step2Enqueuing : format(tc.step2Enqueue, { n: pickedLessons.size })}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── ШАГ 3 ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-[11px] font-bold text-white">3</span>
              <h2 className="text-sm font-bold text-slate-900">{tc.step3Title}</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{tc.step3Hint}</p>

            {bulkDeleteError && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {bulkDeleteError}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPicked(new Set(topics.map((t) => t.id)))}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {tc.step3SelectAll}
              </button>
              <button
                onClick={() => { setPicked(new Set()); setBulkDeleteError(null); }}
                disabled={picked.size === 0}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {tc.step3ClearAll}
              </button>
              <button
                onClick={askBulkDelete}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {format(tc.step3Delete, { n: picked.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Часть 1 — список тем */}
      <div className="space-y-2">
        {topics.map((t, i) => (
          <div
            key={t.id}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              picked.has(t.id) ? "border-red-200 bg-red-50/40" : "border-slate-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Галочка шага 3. Стоит у самой темы, а не отдельным списком в
                  панели: выбирать проще там, где тему видно целиком. */}
              {isOwner && (
                <input
                  type="checkbox"
                  checked={picked.has(t.id)}
                  onChange={() => togglePick(t.id)}
                  className="mt-1.5 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-400"
                />
              )}
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {editingId === t.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => commitEdit(t.id)}
                      className="w-full rounded-lg border border-blue-300 px-2.5 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => commitEdit(t.id)} className="shrink-0 text-emerald-500 hover:text-emerald-600">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => isOwner && startEdit(t)}
                    disabled={!isOwner}
                    className="flex items-center gap-1.5 text-left text-sm font-semibold text-slate-900 disabled:cursor-default"
                  >
                    {t.title}
                    {isOwner && <Pencil className="h-3 w-3 shrink-0 text-slate-300" />}
                  </button>
                )}
                {t.description && <p className="mt-1 text-xs text-slate-500">{t.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {t.used_in_lessons > 0 ? (
                    <>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {tc.topicLessonCreated}{t.used_in_lessons > 1 ? ` (${t.used_in_lessons})` : ""}
                      </span>
                      {/* Урок уже есть — ведём К НЕМУ, а не создаём второй.
                          Рядом стоит когда он: без этого «урок создан» не
                          говорит, куда именно он встал. */}
                      {t.lesson_starts_at && (
                        <span className="text-[10px] text-slate-400">
                          {tt.curTopicLessonAt
                            .replace("{date}", lessonWhen(t.lesson_starts_at).date)
                            .replace("{time}", lessonWhen(t.lesson_starts_at).time)}
                        </span>
                      )}
                    </>
                  ) : usageLoaded && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      {tc.topicLessonNotCreated}
                    </span>
                  )}
                </div>
                {rowError?.id === t.id && <p className="mt-1 text-[11px] text-red-500">{rowError.message}</p>}
                {createError?.id === t.id && <p className="mt-1 text-[11px] text-red-500">{createError.message}</p>}

              </div>
              {/* Кнопка рядом с темой. Всегда на виду, а не за режимом внизу
                  страницы: создание урока — то, ради чего в план и заходят. */}
              {isOwner && editingId !== t.id && (
                t.lesson_id ? (
                  <Link
                    href={`/teacher/lessons/${t.lesson_id}`}
                    className="flex shrink-0 items-center gap-1 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                  >
                    {tt.curTopicOpenLesson}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : usageLoaded && (
                  <button
                    onClick={() => handleCreateLessonForTopic(t)}
                    disabled={creatingFor !== null}
                    className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    {creatingFor === t.id ? tt.curTopicCreating : tt.curTopicCreateLesson}
                  </button>
                )
              )}
              {isOwner && editingId !== t.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => moveTopic(i, -1)} disabled={i === 0 || reordering} className="rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveTopic(i, 1)} disabled={i === topics.length - 1 || reordering} className="rounded-lg p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(t)} className="rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Своя тема. Раньше темы появлялись только из разобранного файла —
            дописать своё было нельзя вовсе. Встаёт в конец списка; переставить
            можно теми же стрелками, что и любую другую. */}
        {isOwner && (
          adding ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
              <p className="text-xs font-bold text-slate-900">{tt.curAddTopicTitle}</p>
              <input
                autoFocus
                value={addTitle}
                onChange={(e) => { setAddTitle(e.target.value); setAddError(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTopic();
                  if (e.key === "Escape") { setAdding(false); setAddError(null); }
                }}
                placeholder={tt.curAddTopicPlaceholder}
                className="mt-2 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <textarea
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder={tt.curAddTopicDescription}
                rows={2}
                className="mt-2 w-full resize-y rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">{tt.curAddTopicHint}</p>
              {addError && <p className="mt-1 text-[11px] text-red-500">{addError}</p>}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => { setAdding(false); setAddError(null); }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {tc.cancel}
                </button>
                <button
                  onClick={handleAddTopic}
                  disabled={addBusy}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {addBusy ? tt.curAddTopicSaving : tt.curAddTopicSave}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-white/60 py-3 text-xs font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
              {tt.curAddTopic}
            </button>
          )
        )}
      </div>

      </>
      )}

      {/* Заказ на наполнение. Спрашиваем ВСЕГДА, а не только при
          перезаполнении: заказ тратит деньги, и нажатие должно быть
          осознанным. Если среди выбранных есть наполненные — говорим числом,
          сколько этапов будет стёрто (стирает разборщик, заход Q2). */}
      {confirmRefill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !enqueueBusy && setConfirmRefill(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-violet-600">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-base font-bold">{format(tc.step2RefillTitle, { n: pickedLessons.size })}</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {выбранныеНаполненные > 0
                ? format(tc.step2RefillBody, { n: выбранныеНаполненные })
                : tc.step2RefillNone}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-slate-500">{tc.step2DrainHint}</p>
            {enqueueError && <p className="mt-3 text-xs text-red-600">{enqueueError}</p>}
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmRefill(false)} disabled={enqueueBusy} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">{tc.cancel}</button>
              <button onClick={handleEnqueue} disabled={enqueueBusy} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                {enqueueBusy ? tc.step2Enqueuing : format(tc.step2Enqueue, { n: pickedLessons.size })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение массового удаления. Решение заказчика 02.09.2026:
          удалять темы с уроками МОЖНО, но человек обязан увидеть число уроков,
          которые потеряют связь с планом. Триггера в базе нет намеренно. */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !bulkDeleting && setConfirmBulkDelete(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">{format(tc.step3ConfirmTitle, { n: pickedTopics.length })}</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              {pickedLessonCount > 0
                ? format(tc.step3ConfirmLessons, { n: pickedLessonCount })
                : tc.step3ConfirmNoLessons}
            </p>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-500">
              {pickedTopics.map((t) => (
                <li key={t.id} className="truncate">
                  {t.title}
                  {t.used_in_lessons > 0 && <span className="ml-1 text-amber-600">({t.used_in_lessons})</span>}
                </li>
              ))}
            </ul>
            {bulkDeleteError && <p className="mt-3 text-xs text-red-600">{bulkDeleteError}</p>}
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">{tc.cancel}</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {bulkDeleting ? tc.deleting : tc.deleteTopicSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !deleting && setConfirmDelete(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">{tc.deleteTopicTitle}</h3>
            </div>
            <p className="text-sm text-slate-600">
              «{confirmDelete.title}»
              {confirmDelete.used_in_lessons > 0 && format(tc.deleteTopicUsedNote, { n: confirmDelete.used_in_lessons })}
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">{tc.cancel}</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? tc.deleting : tc.deleteTopicSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
