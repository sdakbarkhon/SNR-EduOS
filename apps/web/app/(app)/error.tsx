"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Разведка "React #310 при выходе из урока" (Большой фикс: React #310 +
 * заморозка даты + cron) не нашла НИ ОДНОГО нарушения Rules of Hooks нигде
 * по цепочке рендера (LessonWorkspaceView и вся его цепочка предков —
 * AppShell/ScaleWrapper/LessonView/LessonsView/LessonStartBanner/
 * StudentSidebar/NotificationsBell/AiFloatingButton/useRealtimeChannel —
 * проверены построчно). handleLeaveLesson — просто router.push("/schedule"),
 * без setState/мутации БД, так что премиса промта ("ранний return после
 * хука в LessonWorkspaceView") фактически не подтвердилась.
 *
 * У app/(app)/* до этого не было error.tsx вообще — любой клиентский краш
 * (какой бы ни была причина) падал в next.js-дефолтный пустой "Application
 * error" без recovery и без лога. Этот boundary — не "фикс #310" (нечего
 * чинить структурно), а страховка: (1) вместо белого экрана — экран с
 * восстановлением, (2) лог error.message/digest в консоль, чтобы при
 * повторном возникновении был реальный след для точной диагностики.
 */
export default function AppError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  useEffect(() => {
    console.error("[app/(app) error boundary]", error.message, error.digest ? `digest=${error.digest}` : "", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-8 text-center shadow-sm backdrop-blur-xl">
        <AlertTriangle className="h-8 w-8 text-red-500" />
        <h1 className="text-lg font-bold text-slate-800">{d.common.error}</h1>
        <p className="text-sm text-slate-500">
          Что-то пошло не так на этой странице. Попробуйте вернуться к списку уроков.
        </p>
        <a
          href="/lessons"
          className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}
        >
          Вернуться к урокам
        </a>
      </div>
    </div>
  );
}
