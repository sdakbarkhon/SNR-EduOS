"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";

/** Next.js error boundary для /parent/progress — сработает при сбое
 *  getStudentGrades/getChildTeacherReviews (throw-on-error). */
export default function ProgressError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <GlassCard className="flex w-full flex-col items-center gap-3 px-6 py-9 text-center">
        <h1 className="text-lg font-bold" style={{ color: ink1 }}>
          {d.grades.loadError}
        </h1>
        <p className="text-sm" style={{ color: ink2 }}>
          {d.home.nextLessonRetryHint}
        </p>
        <GlassButton onClick={reset}>{d.common.retry}</GlassButton>
      </GlassCard>
    </div>
  );
}
