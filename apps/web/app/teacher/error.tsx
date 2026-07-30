"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Большой фикс — "React #310 ещё живёт на /schedule": разведка проверила
 * ученический /(app) и учительский /teacher целиком (8 параллельных агентов
 * + ручная проверка ключевых файлов) и не нашла ни одного нарушения Rules
 * of Hooks нигде — как и предыдущий заход для apps/web/app/(app)/error.tsx.
 * До этого у /teacher/* НЕ было своего error.tsx вообще (только у
 * ученического (app) — асимметрия), любой клиентский краш падал в голый
 * next.js-дефолтный "Application error" без recovery и без лога. Этот
 * boundary — тот же паттерн, что (app)/error.tsx, для симметрии между
 * учеником и учителем (см. промт: "Открыть все табы учителя тоже — для
 * симметрии").
 */
export default function TeacherError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  useEffect(() => {
    console.error("[app/teacher error boundary]", error.message, error.digest ? `digest=${error.digest}` : "", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-8 text-center shadow-sm backdrop-blur-xl">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-800">{d.common.error}</h1>
        <p className="text-sm text-slate-500">
          Что-то пошло не так на этой странице. Попробуйте вернуться на главную.
        </p>
        <a
          href="/teacher/dashboard"
          className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
        >
          На главную
        </a>
      </div>
    </div>
  );
}
