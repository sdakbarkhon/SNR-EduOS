"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Blocks, ExternalLink, Loader2, Search, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { IframeSandbox } from "@/app/(app)/projects/SandboxView";
import { sandboxToolById } from "@/lib/sandbox-tools";
import { FROM_PLATFORM, postToScratch } from "@/lib/scratch-bridge";
import { getClassScratchProjectUrl, type ClassScratchWork } from "@/app/(app)/projects/scratch/actions";
import { ModalPortal } from "@/components/ModalPortal";

/**
 * Работы Scratch классов учителя. Вкладка внутри «Проектов»: ученик находит
 * Scratch в разделе «Проекты», и учитель находит работы там же — одно слово,
 * одно место.
 *
 * ПОЧЕМУ ПРОСМОТР, А НЕ ПРАВКА. Открывается тот же редактор и тем же мостом,
 * что у ученика: подписанная ссылка на минуту, затем сообщение load в рамку.
 * Но перезаписать работу учитель не может, и это держится на двух опорах:
 *   1. сохранение идёт server action'ом saveScratchProject, а он первым делом
 *      требует профиль ученика и учителю отвечает not_student;
 *   2. этот экран не подписан на сообщения save и share вовсе — редактор их
 *      пошлёт, а слушать некому.
 * Поэтому кнопки редактора «Сохранить» и «Поделиться» здесь просто ничего не
 * делают, и об этом честно сказано плашкой над рамкой.
 */
export function TeacherScratchWorksView({ works }: { works: ClassScratchWork[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.projects;

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<ClassScratchWork | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const groups = useMemo(
    () => [...new Set(works.map((w) => w.groupName).filter((g): g is string => !!g))].sort(),
    [works],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return works.filter((w) => {
      if (group && w.groupName !== group) return false;
      if (!q) return true;
      return (
        w.studentName.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        (w.sourceTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [works, query, group]);

  const fmt = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleString(locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : "ru-RU", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
      }),
    [locale],
  );

  /** Открыть работу: ссылка живёт минуту, файл уходит в рамку сообщением. */
  const openWork = useCallback(async (w: ClassScratchWork) => {
    setBusyId(w.id);
    setError(null);
    try {
      const url = await getClassScratchProjectUrl(w.id);
      if (!url) { setError(t.scratchOpenFailed); return; }
      const res = await fetch(url);
      if (!res.ok) { setError(t.scratchOpenFailed); return; }
      const sb3 = await res.arrayBuffer();
      setOpen(w);
      // Рамка монтируется этим же обновлением состояния, поэтому сообщение
      // шлём после того, как редактор доложит о готовности — он присылает
      // ready, а до него всё сказанное пропадает молча.
      const send = () => postToScratch(frameRef.current, {
        source: FROM_PLATFORM, type: "load", name: w.name, sb3,
      });
      const onReady = (e: MessageEvent) => {
        const data = e.data as { source?: string; type?: string } | null;
        if (data?.source === "snr-scratch" && data.type === "ready") {
          send();
          window.removeEventListener("message", onReady);
        }
      };
      window.addEventListener("message", onReady);
      // Подстраховка: если редактор уже был готов и ready прошёл мимо.
      setTimeout(send, 4000);
    } catch {
      setError(t.scratchOpenFailed);
    } finally {
      setBusyId(null);
    }
  }, [t]);

  if (works.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-12 text-center">
        <Blocks className="mx-auto h-10 w-10 text-amber-400" />
        <p className="mt-3 text-sm font-semibold text-gray-700">{t.scratchEmpty}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">{t.scratchEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{t.scratchHint}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.scratchSearch}
            className="w-full rounded-xl border border-white/50 bg-white/60 py-2.5 pl-11 pr-4 text-sm font-medium text-brand-ink shadow-sm outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {groups.length > 1 && (
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 text-sm font-medium text-brand-ink shadow-sm outline-none"
          >
            <option value="">{t.scratchAllGroups}</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <span className="shrink-0 text-xs font-medium text-gray-500">
          {t.scratchCount.replace("{n}", String(shown.length))}
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-10 text-center text-sm text-gray-500">
          {t.scratchNothingFound}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                <Blocks className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-brand-ink">{w.name}</p>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {w.studentName}
                  {w.groupName ? ` · ${w.groupName}` : ""}
                  {" · "}
                  {w.origin === "homework" ? t.scratchFromHomework : t.scratchFromLesson}
                  {w.sourceTitle ? `: ${w.sourceTitle}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {w.sharedWithClass && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    {t.scratchShared}
                  </span>
                )}
                <span className="text-xs text-gray-400">{fmt(w.updatedAt)}</span>
                <button
                  onClick={() => void openWork(w)}
                  disabled={busyId === w.id}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {busyId === w.id
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.scratchOpening}</>
                    : <><ExternalLink className="h-3.5 w-3.5" /> {t.scratchOpen}</>}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex flex-col bg-black/70 p-3 sm:p-6">
            <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-brand-ink">{open.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {open.studentName}{open.groupName ? ` · ${open.groupName}` : ""}
                </p>
              </div>
              <button
                onClick={() => setOpen(null)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                <X className="h-3.5 w-3.5" /> {t.scratchClose}
              </button>
            </div>
            <div className="bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              {t.scratchViewOnly}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-b-2xl bg-white">
              <IframeSandbox tool={sandboxToolById("scratch")!} name="Scratch" frameRef={frameRef} />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
