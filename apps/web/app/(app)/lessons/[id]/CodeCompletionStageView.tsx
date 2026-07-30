"use client";

import { Puzzle } from "lucide-react";
import { submitStageTask } from "@snr/core";
import type { LessonStageWithProgress, LessonStageProgress, CodeCompletionPayload, CodeCompletionAnswers } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { CodeCompletionExercise } from "@/components/CodeCompletionExercise";

// Большой фикс, Блок 6.5 — обёртка code_completion для живого урока,
// зеркалит контракт CodeStageView.tsx (stage/studentId/onSubmitted) — тот
// же паттерн, что уже используют CodeStageView/ExternalStageModal/
// QiaQuizModal/KahootStudentModal в LessonWorkspaceView.tsx.
export function CodeCompletionStageView({
  stage, studentId, onSubmitted,
}: {
  stage: LessonStageWithProgress;
  studentId: string;
  onSubmitted: (progress: LessonStageProgress) => void;
}) {
  const db = createClient();

  const payload = (stage.config ?? null) as CodeCompletionPayload | null;
  const existing = (stage.progress?.submission_data ?? null) as CodeCompletionAnswers | null;

  async function handleSubmit(result: { answers: Record<string, string>; score: number; total: number }) {
    const progress = await submitStageTask(db, stage.id, studentId, result as unknown as Record<string, unknown>);
    onSubmitted(progress);
  }

  if (!payload || !payload.gaps?.length) {
    return <p className="text-sm text-slate-400">Упражнение недоступно.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Puzzle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-slate-100" title={stage.title}>
            {stage.title}
          </h2>
        </div>
      </div>
      <CodeCompletionExercise
        codeTemplate={payload.code_template}
        gaps={payload.gaps}
        language={payload.language}
        taskDescription={payload.task_description ?? stage.description ?? undefined}
        initialAnswers={existing?.answers ?? null}
        onSubmit={handleSubmit}
        submitLabel="Отправить"
      />
    </div>
  );
}
