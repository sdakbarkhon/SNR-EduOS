"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Puzzle } from "lucide-react";
import { getDictionary, submitCodeCompletionHomework, resolveSubject } from "@snr/core";
import type { HomeworkWithSubmission, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, useLocale } from "@/components";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";
import { CodeCompletionExercise } from "@/components/CodeCompletionExercise";

// Большой фикс, Блок 6.5 — обёртка code_completion для ДЗ, зеркалит
// контракт ProgrammingIDE.tsx/BundleSolver.tsx ({ hw }), тот же паттерн
// диспетчеризации по content_type в HomeworkDetailView.tsx.
export function CodeCompletionSolver({ hw }: { hw: HomeworkWithSubmission }) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const sb = createClient();

  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    sb.from("students").select("id").single().then(({ data, error }) => {
      if (!error && data) setStudentId(data.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = hw.code_completion_data;
  const existing = hw.submission?.code_completion_answers ?? null;
  // Через общий резолвер, как и остальные пять экранов задания: справочник
  // первым, устаревший слаг группы — запасным.
  const subjectStyle = resolveSubject({
    catalog: { name: hw.subjectName, color: hw.subjectColor },
    slug: hw.group.subject,
  });
  const subjectLabel = subjectStyle.label;
  const subjectColor = subjectStyle.color;

  async function handleSubmit(result: { answers: Record<string, string>; score: number; total: number }) {
    if (!studentId) return;
    await submitCodeCompletionHomework(sb, hw.id, studentId, result.answers);
    router.refresh();
  }

  return (
    <div className="py-6">
      <button onClick={() => router.back()} className="mb-5 flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800">
        <ArrowLeft size={16} /> {d.common.back}
      </button>

      <div className="mx-auto max-w-4xl space-y-4">
        <GlassCard className="p-5">
          <div className="flex items-start gap-4">
            <LessonSubjectIcon icon={hw.subjectIcon ?? undefined} color={subjectColor} size={48} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: subjectColor }}>
                  {subjectLabel} · {hw.group.name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  <Puzzle size={11} /> {d.homework.typeCodeCompletion}
                </span>
              </div>
              <h1 className="mb-1 text-xl font-bold text-slate-800">{hw.title}</h1>
              {hw.description && <p className="text-sm text-slate-500">{hw.description}</p>}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          {!payload || !payload.gaps?.length ? (
            <p className="text-sm text-slate-400">Задание недоступно.</p>
          ) : (
            <CodeCompletionExercise
              codeTemplate={payload.code_template}
              gaps={payload.gaps}
              language={payload.language}
              taskDescription={payload.task_description}
              initialAnswers={existing?.answers ?? null}
              onSubmit={handleSubmit}
              submitLabel="Отправить учителю"
            />
          )}
        </GlassCard>

        {hw.submission?.code_completion_answers && (
          <GlassCard className="p-4">
            <span className="text-sm font-semibold text-slate-700">
              Результат: {hw.submission.code_completion_answers.score} из {hw.submission.code_completion_answers.total}
              {hw.submission.grade != null && ` · Оценка: ${hw.submission.grade}`}
            </span>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
