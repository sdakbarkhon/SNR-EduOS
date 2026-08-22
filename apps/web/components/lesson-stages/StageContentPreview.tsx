"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getDictionary, getQuizQuestions, getKahootLeaderboard, getMaterialDownloadUrl } from "@snr/core";
import type { Locale, LessonStage, LessonStatus, QuizQuestion, QuizLeaderboardEntry } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_CONFIG, DEFAULT_EXTERNAL_URLS, isExternalService } from "@/lib/external-services";
import { SlideViewer } from "@/components/lesson-stages/SlideViewer";
import { MarkdownContent } from "@/components/MarkdownContent";
import { QuizReviewList } from "@/components/quiz/QuizReviewList";
import { StageMedia } from "@/components/lesson-stages/StageMedia";
import { stageAllowsMedia } from "@/lib/lesson-stage-media";

/**
 * Содержимое этапа глазами учителя, только для чтения.
 *
 * ОТКУДА ВЗЯЛОСЬ. Это дословно тело StageViewModal — окна, которое открывалось
 * кликом по этапу. Оно и раньше показывало всё: слайды, задание, вопросы теста
 * с правильными ответами, внешний сервис. Беда была не в том, ЧТО оно
 * показывает, а в том, что смотреть приходилось по одному этапу за раз, открыв
 * окно поверх урока. Во время занятия это худший момент, чтобы закрывать собой
 * экран.
 *
 * Поэтому показ вынесен сюда, а окно теперь зовёт этот же компонент. Второго
 * способа показа не появилось: список и окно рисуют один и тот же код, и
 * разойтись им негде.
 *
 * ПРО ПРАВИЛЬНЫЕ ОТВЕТЫ. Здесь они видны всегда — компонент учительский, его
 * не рендерит ни один ученический экран. У ученика свой разбор
 * (StudentStageReviewModal), и он показывает ответы только после того, как
 * ученик ответил сам.
 *
 * ПРАВИТЬ ОТСЮДА НЕЛЬЗЯ. Ни одного поля ввода, ни одной кнопки сохранения —
 * только показ. Правка живёт там же, где и жила: кнопка «Редактировать этап»
 * в окне, открывающая StageModal.
 */

const LIVE_SCORES_POLL_MS = 12000;

export function StageContentPreview({
  stage,
  lessonStatus,
  /** Врезка в список этапов: те же блоки, но ниже ростом — иначе одна карточка
   *  занимает весь экран и «одним взглядом» не получается. */
  compact = false,
  /** У активного этапа картинка и слайды уже нарисованы выше по списку, причём
   *  слайды — с трансляцией классу. Рисовать их второй раз здесь значило бы
   *  показать учителю две презентации, из которых листается только одна. */
  skipMedia = false,
  skipSlides = false,
  /** Живой счёт по тесту. В окне и у активного этапа — да; у остальных строк
   *  списка не нужен и только гонял бы опрос каждые 12 секунд. */
  showLiveScores = true,
}: {
  stage: LessonStage;
  lessonStatus: LessonStatus;
  compact?: boolean;
  skipMedia?: boolean;
  skipSlides?: boolean;
  showLiveScores?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dl = d.lesson;
  const db = createClient();

  const isQuizType = stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot";
  const hasSlidesHere = !skipSlides && !!stage.slides && stage.slides.length > 0;
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(isQuizType);
  const [scores, setScores] = useState<QuizLeaderboardEntry[]>([]);

  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 12 — вручную загруженный .pptx: stage.slides
  // заполняется только у презентаций, сгенерированных AI, поэтому свой
  // залитый файл учитель без этой ветки не видел вовсе. Тот же embed Office
  // Online, что и на ученическом LessonWorkspaceView.
  const presentationFile = (stage.config as { presentation_file?: { storagePath: string; filename: string } } | null)?.presentation_file ?? null;
  const [presentationUrl, setPresentationUrl] = useState<string | null>(null);
  const [presentationFailed, setPresentationFailed] = useState(false);

  useEffect(() => {
    if (!presentationFile) return;
    let cancelled = false;
    setPresentationUrl(null);
    setPresentationFailed(false);
    getMaterialDownloadUrl(db, presentationFile.storagePath, presentationFile.filename)
      .then((u) => { if (!cancelled) setPresentationUrl(u); })
      .catch(() => { if (!cancelled) setPresentationFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationFile?.storagePath, presentationFile?.filename]);

  useEffect(() => {
    if (!isQuizType) return;
    let cancelled = false;
    getQuizQuestions(db, stage.id)
      .then((qs) => { if (!cancelled) setQuestions(qs); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoadingQuiz(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  useEffect(() => {
    if (!isQuizType || !showLiveScores || lessonStatus !== "in_progress") return;
    let cancelled = false;
    const load = () => getKahootLeaderboard(db, stage.id).then((rows) => { if (!cancelled) setScores(rows); }).catch(() => null);
    load();
    const id = setInterval(load, LIVE_SCORES_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id, lessonStatus, showLiveScores]);

  const config = stage.config as { url?: string };
  const serviceMeta = isExternalService(stage.content_type) ? SERVICE_CONFIG[stage.content_type] : null;
  // §9.1 — тот же запасной адрес, что у ученического ExternalStageModal, когда
  // свой не задан.
  const serviceUrl = config?.url || (isExternalService(stage.content_type) ? DEFAULT_EXTERNAL_URLS[stage.content_type] : null);

  /** Высота встраиваемых блоков. Во врезке ниже, в окне как было. */
  const frameCls = compact
    ? "h-[38vh] min-h-[260px]"
    : "h-[50vh] min-h-[360px]";

  // Пустой этап — законное состояние: заготовку могли завести и не наполнить.
  // Без этой строки раскрытая врезка была бы просто пустой рамкой, и учитель
  // решил бы, что содержимое не загрузилось.
  const hasAnything = Boolean(
    stage.description
    || hasSlidesHere
    || presentationFile
    || (stage.content_type === "code" && (stage.starter_code || stage.expected_output))
    || (stage.content_type === "code_completion" && (stage.config as { code_template?: string } | null)?.code_template)
    || (serviceMeta && serviceUrl)
    || isQuizType,
  );

  if (!hasAnything) {
    return <p className="text-sm text-slate-400">{dl.stagePreviewEmpty}</p>;
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* 08.08.2026 — при наличии слайдов картинка внутри слайда, здесь подавлена.
          10.08.2026 — плюс общее правило: картинка только у объяснительных
          этапов (lib/lesson-stage-media.ts). */}
      {!skipMedia && stageAllowsMedia(stage.content_type) && (
        <StageMedia
          image_url={hasSlidesHere ? null : ((stage as { image_url?: string | null }).image_url ?? null)}
          media_status={(stage as { media_status?: "pending" | "generated" | "failed" | null }).media_status ?? null}
          media_queued_at={(stage as { media_queued_at?: string | null }).media_queued_at ?? null}
          isTeacher
          stageId={stage.id}
        />
      )}

      {stage.description && <MarkdownContent text={stage.description} className="text-sm text-slate-700 dark:text-slate-200" />}

      {hasSlidesHere && (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          {/* 07.08.2026 — презентация этапа открывается во весь экран,
              симметрично ученику (StudentPresentationViewer). Выход —
              Esc и кнопка закрытия, см. SlideViewer.tsx.
              isTeacher: без него SlideViewer считал листание разрешённым
              только при lessonStatus completed/in_progress, и учитель,
              открывший презентацию ДО начала урока, не мог пролистать
              дальше первого слайда. Трансляции отсюда нет и не было —
              stageId не передаётся, значит ни записи current_slide_index,
              ни подписки: этот просмотр целиком локальный.
              autoFullscreen только в окне: врезка в списке не имеет права
              разворачиваться на весь экран сама, учитель её не просил. */}
          <SlideViewer
            slides={stage.slides ?? []}
            canExport={false}
            onExportPptx={() => {}}
            lessonStatus={lessonStatus}
            isTeacher
            autoFullscreen={!compact}
            stageImageUrl={(stage as { image_url?: string | null }).image_url ?? null}
          />
        </div>
      )}

      {presentationFile && (
        presentationFailed ? (
          <div className={`flex ${frameCls} items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-sm text-orange-700`}>
            {d.common.error}
          </div>
        ) : !presentationUrl ? (
          <div className={`flex ${frameCls} items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-400`}>
            {d.common.loading}
          </div>
        ) : (
          <div className={`${frameCls} overflow-hidden rounded-xl border border-slate-100`}>
            <iframe
              src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(presentationUrl)}`}
              title={presentationFile.filename}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        )
      )}

      {stage.content_type === "code" && (
        <div className="space-y-3">
          {stage.programming_language && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {stage.programming_language}
            </p>
          )}
          <pre className={`overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100 ${compact ? "max-h-64 overflow-y-auto" : ""}`}>
            <code>{stage.starter_code || "—"}</code>
          </pre>
          {stage.expected_output && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dl.code.expectedOutput}
              </p>
              <pre className={`overflow-x-auto rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ${compact ? "max-h-40 overflow-y-auto" : ""}`}>
                {stage.expected_output}
              </pre>
            </div>
          )}
        </div>
      )}

      {stage.content_type === "code_completion" && (() => {
        const payload = (stage.config ?? null) as { code_template?: string; gaps?: { id: string; correct: string }[]; language?: string } | null;
        if (!payload?.code_template) return null;
        // Учителю пропуски показываются ЗАПОЛНЕННЫМИ — это и есть ответ.
        const preview = payload.gaps?.reduce(
          (acc, g) => acc.replaceAll(`__${g.id}__`, `[${g.correct}]`),
          payload.code_template,
        ) ?? payload.code_template;
        return (
          <div className="space-y-3">
            {payload.language && (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{payload.language}</p>
            )}
            <pre className={`overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100 ${compact ? "max-h-64 overflow-y-auto" : ""}`}>
              <code>{preview}</code>
            </pre>
            <p className="text-xs text-slate-400">
              {dl.stagePreviewGaps.replace("{n}", String(payload.gaps?.length ?? 0))}
            </p>
          </div>
        );
      })()}

      {serviceMeta && serviceUrl && (
        <div className="space-y-2">
          <div className={`${frameCls} overflow-hidden rounded-xl border border-slate-100`}>
            <iframe
              src={serviceUrl}
              title={serviceMeta.name}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full border-0 bg-white"
            />
          </div>
          <a
            href={serviceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> {serviceMeta.name}
          </a>
        </div>
      )}

      {isQuizType && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{dl.quiz.test}</h3>
          {loadingQuiz ? (
            <p className="text-sm text-slate-400">…</p>
          ) : questions.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            // 08.08.2026 — общий вид разбора (QuizReviewList): карточка на
            // вопрос с крупным номером, варианты плитками, правильный со
            // значком. Раньше тут был свой список — такой же, как ещё в
            // трёх местах, и расходиться ему было делом времени.
            <QuizReviewList
              questions={questions.map((q) => ({
                key: q.id,
                text: q.question_text,
                options: q.options.map((opt, oi) => ({
                  text: opt,
                  correct: oi === q.correct_option_index,
                })),
              }))}
            />
          )}

          {showLiveScores && lessonStatus === "in_progress" && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-violet-700">{dl.liveScores.title}</h3>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" /> {dl.liveScores.updating}
                </span>
              </div>
              {scores.length === 0 ? (
                <p className="text-sm text-violet-400">{dl.liveScores.empty}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-violet-500">
                      <th className="pb-2">{dl.liveScores.student}</th>
                      <th className="pb-2">{dl.liveScores.correct}</th>
                      <th className="pb-2">{dl.liveScores.grade}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-100">
                    {scores.map((s) => (
                      <tr key={s.student_id}>
                        <td className="py-2 font-semibold text-slate-800">{s.full_name}</td>
                        <td className="py-2 text-slate-600">{s.correct_count}/{questions.length || "—"}</td>
                        <td className="py-2 font-bold text-violet-700">{s.total_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
