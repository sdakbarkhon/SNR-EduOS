"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft, MapPin, Clock, CalendarX, Calendar, X, ListChecks, Play, BookOpen,
} from "lucide-react";
import { getSubjectStyle, formatTime, formatDate, getDictionary } from "@snr/core";
import type { StudentLessonView, ExcuseRequest, Locale, LessonStagePreview } from "@snr/core";
import { useIsPastDayLesson } from "@/components/SchoolTimeProvider";
import {
  getMyExcuseRequest, createExcuseRequest, deleteExcuseRequest, getLessonStagesPreview,
  tashkentDayBoundsUtc,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/Toast";
import { useRealtimeChannel } from "@/lib/realtime";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { lessonContentTypeIcon, lessonContentTypeLabel } from "@/lib/lesson-content-type";

// Ташкентское смещение (UTC+5, фиксированное — не полагаемся на системный TZ
// сервера/браузера).
// 26.08.2026: своя копия смещения снесена — границы ташкентских суток считает
// общий помощник, packages/core/src/utils/date.ts.

function SubjectHeroIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = (icon && LUCIDE_ICONS[icon]) || BookOpen;
  return <Icon className={className} strokeWidth={2.2} />;
}

// 11.08.2026 — свои switch'и с подписями и значками отсюда убраны: они
// отставали от списка типов на scratch, typerun и google_docs (ученик видел
// пустую подпись). Теперь общий источник — lib/lesson-content-type.ts.

export function PreLessonView({
  lesson,
  studentId,
}: {
  lesson: StudentLessonView;
  studentId: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  // Z.3, заход 3 — зеркало триггера trg_block_past_day_lesson_start по школе
  // текущего пользователя (см. isPastDayLessonForSchool в lib/school-time.ts).
  const isPastDay = useIsPastDayLesson();
  const showToast = useToast();
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);
  const style = getSubjectStyle(lesson.group.subject);

  // Live clock (client-only — null on SSR to avoid hydration mismatch)
  const [nowMs, setNowMs] = useState<number | null>(null);
  // Ученик стартует урок POST'ом к /api/lessons/[id]/start-with-close-previous —
  // тот же полноценный переход lessons.status -> 'in_progress' для всех, что
  // и учитель, ПЛЮС автоматическое закрытие предыдущего урока того же класса
  // того же дня (если тот ещё не завершён). Требует RLS-политики "student
  // starts own scheduled lesson" (см. отчёт — SQL для менеджера, не применена
  // этой правкой).
  const [starting, setStarting] = useState(false);

  // Excuse request state
  const [excuse, setExcuse] = useState<ExcuseRequest | null | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Stage plan preview — safe fields only (id/title/content_type/position/
  // duration_min), fetched separately from `lesson.stages` so we never ship
  // config/slides/quiz data to the client before the lesson actually starts.
  const [stages, setStages] = useState<LessonStagePreview[] | null>(null);

  // 08.08.2026 — экран ожидания стал полноэкранным слоем через портал в body
  // (см. развёрнутый комментарий у return). Портал нельзя строить на сервере,
  // а ветвление "на сервере одно дерево, на клиенте другое" в этом проекте
  // уже приводило к React #418/#310 (подробности в ScaleWrapper.tsx). Поэтому
  // до монтирования компонент отдаёт null И на сервере, И в первом клиентском
  // рендере — разметка совпадает, гидратация чистая, слой появляется кадром
  // позже. Данные экрана всё равно клиентские (часы, план этапов).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Пока слой открыт, страница под ним скроллиться не должна — тот же приём,
  // что в SlideViewer. Трогаем именно overflowY, а не сокращение overflow:
  // ScaleWrapper на вьюпортах шире 1920px держит собственный overflowX:hidden
  // на body, и восстановление сокращения снесло бы его (его эффект на наш
  // размонтаж не пересрабатывает — зависимости другие).
  useEffect(() => {
    const prev = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => { document.body.style.overflowY = prev; };
  }, []);

  useEffect(() => {
    // createClient() must run only in the browser (accesses document.cookie)
    const db = createClient();
    dbRef.current = db;

    setNowMs(Date.now());
    const clockId = setInterval(() => setNowMs(Date.now()), 1000);

    if (studentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getMyExcuseRequest(db as any, lesson.id, studentId)
        .then((e) => setExcuse(e))
        .catch(() => setExcuse(null));
    } else {
      setExcuse(null);
    }

    getLessonStagesPreview(db, lesson.id)
      .then((s) => setStages(s))
      .catch(() => setStages([]));

    return () => clearInterval(clockId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, studentId]);

  // 07.08.2026 — ученик застревал на экране ожидания после того, как учитель
  // начал урок: у учителя урок «идёт», у ученика тот же урок «в ожидании».
  //
  // Причина — НЕ доставка данных. Проверено симуляцией: смена статуса видна
  // ученику под его же RLS мгновенно, realtime для lessons включён,
  // REPLICA IDENTITY FULL на месте. Ломался последний шаг — перерисовка.
  // Здесь и в поллинге ниже стоял `router.refresh()`, а страница урока
  // ветвится по `lesson.status` (LessonView: scheduled → PreLessonView,
  // in_progress → LessonWorkspaceView), и статус приходит пропом из
  // серверного компонента.
  //
  // Что этот же проект уже выяснил про router.refresh() — дословно из
  // TeacherLessonDetailView.tsx: «router.refresh alone is unreliable for
  // Server Components in Next 15». Именно поэтому УЧИТЕЛЬ делает
  // window.location.reload() и в realtime-колбэке, и в своём поллинге — и
  // поэтому у учителя статус обновлялся, а у ученика нет. Асимметрия была
  // ровно в этом.
  //
  // Повторяем учительский приём: сравниваем пришедший статус с текущим и,
  // если он изменился, делаем полную перезагрузку. Она гарантирует свежие
  // серверные пропы, а значит и правильную ветку экрана.
  useRealtimeChannel(`lesson-status-${lesson.id}`, "lessons", `id=eq.${lesson.id}`, (payload) => {
    const newStatus = payload?.new?.status as string | undefined;
    if (newStatus && newStatus !== lesson.status) window.location.reload();
  });

  // Страховка на случай, если realtime-событие не дойдёт. Спрашиваем статус
  // напрямую, а не router.refresh() — по той же причине, что выше.
  useEffect(() => {
    const poll = setInterval(() => {
      const db = dbRef.current ?? createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any)
        .from("lessons")
        .select("status")
        .eq("id", lesson.id)
        .maybeSingle()
        .then(({ data }: { data: { status: string } | null }) => {
          if (data?.status && data.status !== lesson.status) window.location.reload();
        })
        .catch(() => null);
    }, 5000);
    return () => clearInterval(poll);
  }, [lesson.id, lesson.status]);

  // Зациклённый таймер (LOOPED countdown, 45 мин цикл, anchor = сегодня 09:55
  // Ташкент). Не привязан к starts_at конкретного урока — это визуальный
  // "пульс" школьного дня, помогающий держать ритм между уроками. До 09:55
  // Ташкент отсчитывает время до анкора; после 09:55 — отсчитывает от 45:00
  // до 00:00 и снова к 45:00, бесконечно.
  const LOOP_MS = 45 * 60 * 1000;
  function anchor0955TashkentUtcMs(now: number): number {
    // 09:55 Ташкент = 04:55 UTC. Полночь ташкентских суток берём у общего
    // помощника: на системный часовой пояс не полагаемся.
    const tashkentMidnightUtcMs = new Date(tashkentDayBoundsUtc(now).startIso).getTime();
    return tashkentMidnightUtcMs + 9 * 60 * 60 * 1000 + 55 * 60 * 1000;
  }
  const secsUntil: number | null = (() => {
    if (nowMs === null) return null;
    const anchor = anchor0955TashkentUtcMs(nowMs);
    const elapsed = nowMs - anchor;
    if (elapsed < 0) {
      // Ещё до 09:55 — показываем сколько осталось до анкора.
      return Math.floor(-elapsed / 1000);
    }
    // После 09:55 — оставшееся время в текущем 45-минутном цикле.
    const remainMs = LOOP_MS - (elapsed % LOOP_MS);
    return Math.floor(remainMs / 1000);
  })();

  // Раньше здесь был useEffect(refresh() при secsUntil===0) — убран: таймер
  // теперь зациклённый, "0" наступает каждые 45 минут и не означает "урок
  // сейчас должен начаться". Realtime + 5-секундный polling выше подхватят
  // фактический start_at→in_progress без принудительного refresh на нуле.

  async function handleStartLesson() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/lessons/${lesson.id}/start-with-close-previous`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "unknown" }));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      // Не сбрасываем starting=false тут — успешный старт переводит
      // lesson.status в 'in_progress', перезагрузка отдаёт свежие серверные
      // пропы, LessonView переключается с PreLessonView на
      // LessonWorkspaceView, и этот компонент размонтируется.
      //
      // 07.08.2026: здесь тоже был router.refresh() — та же ловушка, что
      // выше (ненадёжен для Server Components в Next 15), то есть ученик,
      // начавший урок САМ, точно так же оставался на экране ожидания.
      window.location.reload();
    } catch (e) {
      console.error("[PreLessonView] start-with-close-previous failed:", (e as Error)?.message ?? e);
      showToast(d.common.error);
      setStarting(false);
    }
  }

  async function submitExcuse() {
    const db = dbRef.current;
    if (!studentId || !db) return;
    if (reason.trim().length < 5) { setError(dl.excuse.minLengthError); return; }
    setSubmitting(true);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await createExcuseRequest(db as any, lesson.id, studentId, reason);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = await getMyExcuseRequest(db as any, lesson.id, studentId);
      setExcuse(e);
      setModalOpen(false);
      setReason("");
    } catch {
      setError(d.common.error ?? "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelExcuse() {
    const db = dbRef.current;
    if (!studentId || !db) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteExcuseRequest(db as any, lesson.id, studentId);
      setExcuse(null);
    } catch { /* noop */ }
  }

  const heroTitle = lesson.subjectName ?? style.label;
  const timeRange = lesson.ends_at
    ? `${formatTime(lesson.starts_at)} — ${formatTime(lesson.ends_at)}`
    : formatTime(lesson.starts_at);
  const dateStr = formatDate(lesson.starts_at);

  // Countdown display. Формат:
  //   < 60 сек → "SS" (два больших разряда — визуальный акцент финального
  //     отсчёта цикла);
  //   < 60 мин → "MM:SS" (типичный вид, зациклённый 45-минутный отсчёт всё
  //     время в этом диапазоне);
  //   >= 60 мин (только когда сейчас ещё до 09:55 Ташкент) → "HHч MMм".
  // Строка держится короткой, чтобы влезать в кольцо (counterSizeClass ниже).
  //
  // isUrgent: последняя минута каждого 45-минутного цикла — визуально
  // подсвечиваем розовым/pulse. Раньше был кейс "секунды застряли на 0" —
  // после перехода на LOOPED countdown такого состояния нет.
  const isUrgent = secsUntil !== null && secsUntil > 0 && secsUntil < 60;
  const counterText = (() => {
    if (secsUntil === null) return "—:—";
    if (secsUntil < 60) return String(secsUntil).padStart(2, "0");
    if (secsUntil < 3600) {
      const mm = Math.floor(secsUntil / 60);
      const ss = secsUntil % 60;
      return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    }
    const hh = Math.floor(secsUntil / 3600);
    const mm = Math.floor((secsUntil % 3600) / 60);
    return `${hh}ч ${String(mm).padStart(2, "0")}м`;
  })();
  // 3 size tiers by string length so longer formats never overflow the ring.
  const counterSizeClass =
    counterText.length <= 2 ? "text-8xl md:text-9xl"
    : counterText.length <= 5 ? "text-6xl md:text-7xl"
    : "text-5xl md:text-6xl";

  // SVG ring (r=140 for the larger w-96 circle). frac визуализирует прогресс
  // текущего 45-минутного цикла (или отсчёт до 09:55, если ещё раньше).
  const R = 140;
  const C = 2 * Math.PI * R;
  const frac = secsUntil === null ? 1 : Math.min(1, secsUntil / (LOOP_MS / 1000));

  const plannedStartLabel = formatTime(lesson.starts_at);

  // 11.08.2026 — в подписи осталось ТОЛЬКО число этапов, минуты убраны
  // (решение заказчика). Сумма длительностей этапов и длительность урока —
  // независимые величины: урок длится lessons.duration_minutes (из неё
  // триггер fn_compute_lesson_end считает ends_at), а duration_min у этапов
  // проставляет генератор и он ничем не связан с уроком. После уборки
  // шаблонных этапов сумма у части уроков стала меньше 45, и подпись
  // «~23 мин» под 45-минутным уроком читалась как ошибка. Само поле
  // длительности не трогаем: оно осталось на карточке каждого этапа.
  const planSummary = dl.planStagesSummary.replace("{count}", String((stages ?? []).length));

  // 08.08.2026 — НАСТОЯЩИЙ полноэкранный режим.
  //
  // Предыдущие два захода (e629b1e, 11e9cb9) требование поняли неверно: они
  // растягивали КАРТОЧКУ внутри области контента — сначала сняв max-w в
  // LessonView, потом подгоняя min-h под высоту каркаса. Карточка при этом
  // оставалась внутри сайдбара, топбара и <main> с прокруткой, то есть
  // «на весь экран» она не становилась в принципе, сколько ни считай отступы.
  //
  // Приём взят у полноэкранной презентации (SlideViewer.tsx, e629b1e):
  // портал в <body> плюс fixed inset-0 z-[9999]. Портал здесь обязателен, а не
  // косметика — у предков есть и overflow-hidden, и собственные
  // stacking-контексты, из-под них никакой z-index карточку не поднимет.
  // z-[9999] выбран не наугад: он перекрывает всё, что позиционируется
  // отдельно от потока — LessonStartBanner (z-[9998]), DemoBanner (z-[100]),
  // кнопку помощника (z-40/z-50). Сайдбар, топбар и BottomNav лежат в потоке
  // и накрываются самим слоем.
  //
  // Каркас AppShell НЕ переключается в свой fullscreen-режим
  // (useRegisterFullscreenLesson): тот задуман для живого урока
  // (fullscreen-lesson-context.tsx), меняет дерево целиком и к экрану ожидания
  // отношения не имеет. Слоя поверх достаточно, а дерево страницы остаётся
  // нетронутым.
  //
  // overflow-y-auto на самом слое, а не overflow-hidden: план урока из многих
  // этапов на коротком вьюпорте выше 100vh, и без прокрутки внутри слоя кнопка
  // «Начать урок» оказалась бы недостижимой. Прокрутка страницы при этом
  // заблокирована эффектом выше — скроллится только содержимое слоя.
  //
  // Ученика здесь НЕ запираем (в отличие от презентации, d8162ad): «Назад к
  // расписанию» — обычная ссылка, работает всегда и без удержания.
  const body = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 text-white">
      {/* Единственный выход со слоя, поэтому fixed, а не absolute: слой
          прокручивается внутри себя, и absolute-кнопка уехала бы вверх вместе
          с содержимым на коротком вьюпорте. Портал лежит в body, вне
          ScaleWrapper, так что трансформированного предка над ней нет и fixed
          привязывается к вьюпорту на любой ширине. */}
      <Link
        href="/schedule"
        className="fixed left-6 top-6 z-10 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white/80 backdrop-blur-md transition hover:bg-white/20"
      >
        <ChevronLeft className="h-4 w-4" />
        {dl.back}
      </Link>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 gap-10 px-6 pb-16 pt-24 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-16 lg:py-16">

        {/* LEFT: Info */}
        <div className="flex flex-col">
          {/* Live badge */}
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-teal-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-teal-200 backdrop-blur-md border border-teal-300/30">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
            {dl.nowStarting}
          </span>

          {/* Subject icon + name — white-on-translucent to match this screen's
              dark hero (LessonSubjectIcon's light-background tint would be
              invisible here, so the badge is built inline instead). */}
          <div className="mb-4 flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
              <SubjectHeroIcon icon={lesson.subjectIcon} className="h-7 w-7 text-white" />
            </span>
            <h1 className="text-5xl font-black leading-tight tracking-tight md:text-6xl lg:text-7xl">
              {heroTitle}
            </h1>
          </div>

          {/* Group · Teacher */}
          <p className="mb-8 text-xl font-medium text-white/70 md:text-2xl">
            {lesson.group.name}
            {lesson.teacher ? ` · ${lesson.teacher.full_name}` : ""}
          </p>

          {/* Date / Time / Room pills */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
              <Calendar className="h-4 w-4 text-white/60" />
              {dateStr}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
              <Clock className="h-4 w-4 text-white/60" />
              {timeRange}
            </span>
            {lesson.room && (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm font-medium backdrop-blur-md">
                <MapPin className="h-4 w-4 text-white/60" />
                {dl.cabinet} {lesson.room}
              </span>
            )}
          </div>

          {/* Stage plan preview — titles + type icons only, no content (not
              clickable — nothing to open before the lesson actually starts).
              Rendered for every student once stages have loaded, even when
              empty (placeholder instead), so the layout never differs by
              how much data a given lesson happens to have. */}
          {stages !== null && (
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <ListChecks className="h-[21px] w-[21px] text-orange-300" />
                <span className="font-semibold text-[15px] uppercase tracking-wide text-white/80">
                  {dl.workspace.stagePlan}
                </span>
                {stages.length > 0 && (lesson.title || lesson.topic) && (
                  <span className="ml-auto truncate text-sm font-extrabold text-orange-300">
                    {dl.planTopicPrefix} {lesson.title ?? lesson.topic}
                  </span>
                )}
              </div>
              <div className="my-4 h-px bg-white/10" />
              {stages.length > 0 ? (
                <>
                  <div className="flex flex-col gap-4">
                    {stages.map((stage) => {
                      const Icon = lessonContentTypeIcon(stage.content_type, BookOpen);
                      return (
                        <div key={stage.id} className="flex items-center gap-3.5">
                          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-orange-400/20 text-orange-200">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[17px] font-extrabold text-white">{stage.title}</p>
                            <p className="text-[13px] font-semibold text-white/55">
                              {lessonContentTypeLabel(stage.content_type, dl)}
                              {stage.duration_min ? ` · ~${stage.duration_min} ${d.schedule.minShort}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3.5 text-center text-xs font-bold uppercase tracking-wide text-white/45">
                    {planSummary}
                  </div>
                </>
              ) : (
                <p className="py-2 text-center text-sm font-medium text-white/50">
                  {dl.planEmptyPlaceholder}
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Timer + excuse */}
        <div className="flex flex-col items-center gap-6">
          {/* Countdown ring */}
          <div className="relative flex h-72 w-72 items-center justify-center md:h-96 md:w-96">
            <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full -rotate-90">
              <defs>
                <linearGradient id="waitRingGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FFC7A6" />
                  <stop offset="1" stopColor="#FF7A4D" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="160" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
              <circle
                cx="160" cy="160" r={R} fill="none"
                stroke={isUrgent ? "#fb7185" : "url(#waitRingGradient)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - frac)}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="flex flex-col items-center justify-center px-6 text-center">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">{dl.untilStart}</span>
              <span
                className={`mt-1.5 whitespace-nowrap font-mono font-extrabold tabular-nums leading-none ${counterSizeClass} ${isUrgent ? "animate-pulse text-rose-300" : ""}`}
                style={isUrgent ? undefined : { background: "linear-gradient(180deg,#FFCFB2,#FF7A4D)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
              >
                {counterText}
              </span>
              {/* Плановое начало этого конкретного урока — не совпадает с
                  таймером выше (тот — LOOPED, "пульс дня"). Держим рядом,
                  чтобы визуально не терять привязку урока ко времени. */}
              <span className="mt-3 text-xs font-semibold tracking-wide text-white/45">
                {dl.plannedStart}: <span className="text-white/80">{plannedStartLabel}</span>
              </span>
            </div>
          </div>

          {/* Раньше здесь был статический текст "Урок откроется, когда его
              начнёт учитель" — теперь ученик тоже может начать урок сам,
              той же startLesson(), что и учитель (handleStartLesson выше,
              полноценный status -> 'in_progress' для всех, не локальный
              вход). Realtime/polling выше по-прежнему подхватывают старт,
              если урок первым начнёт учитель — кнопка не единственный путь,
              просто ещё один.
              П.2: в школе с автостартом (schoolAutostartEnabled) уроки
              стартуют кроном по расписанию — ручной кнопки у ученика там
              быть не должно (API-роут start-with-close-previous всё равно
              отдаст 403, это просто убирает мёртвую кнопку из UI). */}
          {/* 07.08.2026: урок прошедшего дня начать нельзя — БД отдаёт P0001
              (триггер trg_block_past_day_lesson_start, миграция 173). Здесь
              вместо кнопки показываем причину, чтобы человек не упирался в
              сырую ошибку Postgres. Замороженный день и всё, что позже,
              по-прежнему стартуется — включая 3-й урок и дальше, то есть
              правило 1/2/3+ не затронуто. */}
          {!lesson.schoolAutostartEnabled && (
            isPastDay(lesson.starts_at) ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white/60 backdrop-blur-md">
                {dl.startBlockedPastDay}
              </span>
            ) : (
              <button
                onClick={handleStartLesson}
                disabled={starting}
                className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 px-8 py-3 text-base font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <Play className="h-5 w-5" fill="currentColor" />
                {starting ? "…" : dl.startLessonBtn}
              </button>
            )
          )}

          {/* Excuse button (replaces the old "Перейти сейчас") */}
          {studentId && excuse !== undefined && !excuse && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/20 px-6 py-2.5 text-sm font-semibold text-cyan-200 backdrop-blur-md transition hover:bg-cyan-400/30"
            >
              <CalendarX className="h-4 w-4" />
              {dl.excuse.button}
            </button>
          )}
          {studentId && excuse && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white/80 backdrop-blur-md">
              <CalendarX className="h-4 w-4 text-white/50" />
              {dl.excuse.requestedTitle}
              <button onClick={cancelExcuse} className="ml-1 text-white/40 hover:text-white/80">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Excuse modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#1e293b] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <h3 className="text-lg font-bold text-white">{dl.excuse.title}</h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-white/40 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-white/60">{dl.excuse.subtitle}</p>
            <label className="mb-1.5 block text-sm font-medium text-white/80">{dl.excuse.reasonLabel}</label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError(""); }}
              placeholder={dl.excuse.reasonPlaceholder}
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
            {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5"
              >
                {dl.excuse.cancel}
              </button>
              <button
                onClick={submitExcuse}
                disabled={submitting || reason.trim().length < 5}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? dl.excuse.sending : dl.excuse.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // До монтирования — null и на сервере, и в первом клиентском рендере, иначе
  // деревья разойдутся (см. комментарий к `mounted`).
  if (!mounted) return null;
  return createPortal(body, document.body);
}
