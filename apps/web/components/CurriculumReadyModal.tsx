"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useRealtimeChannel, type RealtimePayload } from "@/lib/realtime";

type ReadyEvent = { planId: string; title: string; kind: "ready" | "error" };

/**
 * Большой фикс, Блок 6, ЗАДАЧА 1 — глобальное уведомление о готовности
 * фонового парсинга учебного плана. Подписан на ВСЕ curriculum_plans
 * учителя (на момент монтирования неизвестно, какой именно план сейчас
 * парсится) — срабатывает только на переход processing → ready/error, что
 * автоматически исключает существующие планы (у них status='ready' с самого
 * начала, никогда не было 'processing', значит такого перехода не будет).
 * Не показывается на странице самого плана — там прогресс уже виден инлайн
 * (CurriculumPlanDetailView.tsx).
 */
export function CurriculumReadyModal({ teacherId }: { teacherId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [event, setEvent] = useState<ReadyEvent | null>(null);

  useRealtimeChannel(
    `curriculum-plans-teacher-${teacherId}`,
    "curriculum_plans",
    `teacher_id=eq.${teacherId}`,
    (payload: RealtimePayload) => {
      const wasProcessing = payload.old?.status === "processing";
      const nowStatus = payload.new?.status as string | undefined;
      if (!wasProcessing || !nowStatus || nowStatus === "processing") return;
      const planId = payload.new?.id as string | undefined;
      if (!planId || pathname === `/teacher/curriculum/${planId}`) return;
      setEvent({ planId, title: (payload.new?.title as string) ?? "План", kind: nowStatus === "ready" ? "ready" : "error" });
    },
  );

  if (!event) return null;
  const isReady = event.kind === "ready";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setEvent(null)}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <button onClick={() => setEvent(null)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-500">
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isReady ? "bg-emerald-100" : "bg-red-100"}`}>
            {isReady
              ? <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              : <AlertTriangle className="h-7 w-7 text-red-600" />}
          </div>
          <h2 className="mb-1 text-lg font-bold text-slate-900">{isReady ? "План готов!" : "Ошибка разбора плана"}</h2>
          <p className="mb-6 text-sm text-slate-500">
            «{event.title}»{isReady ? " — AI разложил файл на темы." : " — не удалось разобрать файл."}
          </p>
          <div className="flex w-full gap-2">
            <button onClick={() => setEvent(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Закрыть
            </button>
            <button
              onClick={() => { router.push(`/teacher/curriculum/${event.planId}`); setEvent(null); }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${isReady ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              Показать план
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
