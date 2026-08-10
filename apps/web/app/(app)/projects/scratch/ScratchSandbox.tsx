"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FolderOpen, Loader2, Share2, Trash2, X } from "lucide-react";
import { getDictionary, format, LOCALE_TAG, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { useToast } from "@/components/Toast";
import {
  FROM_PLATFORM,
  SCRATCH_PROJECT_LIMIT,
  parseScratchMessage,
  postToScratch,
  type ScratchOutgoing,
} from "@/lib/scratch-bridge";
import {
  deleteScratchProject,
  getScratchProjectUrl,
  listScratchProjects,
  saveScratchProject,
  type ScratchProject,
} from "./actions";

/**
 * Платформенная половина Scratch. Z-Scratch, 10.08.2026.
 *
 * ЧТО ЭТО. Обёртка вокруг рамки редактора: наша панель сверху и выдвижной
 * список «Мои работы» сбоку. Сама рамка приходит сюда как children — её
 * по-прежнему рисует общий IframeSandbox из SandboxView со своей загрузкой и
 * обработкой ошибки. Второй рамки здесь нет намеренно: копии в этом проекте
 * расходились семь раз.
 *
 * ПОЧЕМУ НЕ ОТДЕЛЬНЫЙ МАРШРУТ. Список открывается поверх редактора, а не
 * вместо него: родная кнопка «Мои работы» в редакторе просит платформу
 * показать список, и уход на другой адрес потерял бы несохранённую работу.
 * Точка входа остаётся одна — карточка Scratch в песочнице.
 *
 * ПРОТОКОЛ. Сверен с пересобранной сборкой (scratch/snr-changes.patch,
 * src/lib/snr-bridge.js):
 *   редактор → платформа: ready, save, share, my-projects;
 *   платформа → редактор: load.
 * Событие save-result в контракте объявлено, и мы его шлём, но СБОРКА ЕГО
 * СЕЙЧАС НЕ СЛУШАЕТ — её listen() разбирает только load. Поэтому итог
 * сохранения показываем сами, а не надеемся на плашку редактора.
 *
 * ПОРЯДОК ЗАПУСКА. Редактор вешает слушатель при монтировании меню и сразу
 * шлёт ready. Всё, что уйдёт раньше, пропадёт молча — поэтому «load»
 * до ready кладётся в очередь и уходит, как только редактор отзовётся.
 */
export function ScratchSandbox({
  frameRef,
  children,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.sandbox.scratch;
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [projects, setProjects] = useState<ScratchProject[] | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ScratchProject | null>(null);

  /** Какая сохранённая работа открыта в редакторе: следующее «Сохранить»
   *  перезапишет её, а не заведёт ещё одну копию и не съест лимит. */
  const activeIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const pendingLoadRef = useRef<{ name: string; sb3: ArrayBuffer } | null>(null);
  const savingRef = useRef(false);
  /** Зеркало panelOpen для обработчика сообщений: он живёт вне рендера и
   *  видел бы устаревшее значение состояния. */
  const panelOpenRef = useRef(false);
  useEffect(() => { panelOpenRef.current = panelOpen; }, [panelOpen]);

  const refresh = useCallback(async () => {
    setListBusy(true);
    try {
      setProjects(await listScratchProjects());
    } catch {
      setProjects([]);
    } finally {
      setListBusy(false);
    }
  }, []);

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    void refresh();
  }, [refresh]);

  /** Машинный код отказа → фраза для человека. До этого server action
   *  возвращал немой {ok:false} и ученик видел, что «ничего не произошло». */
  const errorText = useCallback(
    (code: "not_student" | "too_big" | "limit" | "failed"): string =>
      code === "not_student" ? t.errNotStudent
        : code === "too_big" ? t.errTooBig
          : code === "limit" ? t.errLimit
            : t.errFailed,
    [t],
  );

  const handleSave = useCallback(
    async (msg: Extract<ScratchOutgoing, { type: "save" | "share" }>) => {
      // Двойное нажатие по кнопке редактора не должно порождать две работы.
      if (savingRef.current) return;
      savingRef.current = true;
      setStatus(t.saving);
      try {
        const fd = new FormData();
        fd.set("sb3", new File([msg.sb3], "project.sb3", { type: "application/x.scratch.sb3" }));
        fd.set("name", msg.name);
        fd.set("origin", "sandbox");
        if (msg.type === "share") fd.set("share", "1");
        const current = activeIdRef.current;
        if (current) fd.set("projectId", current);

        const res = await saveScratchProject(fd);
        if (res.ok) {
          activeIdRef.current = res.id;
          toast(msg.type === "share" ? t.sharedOk : t.savedOk);
          postToScratch(frameRef.current, { source: FROM_PLATFORM, type: "save-result", ok: true });
          if (panelOpenRef.current) await refresh();
          else setProjects(null); // список перечитается при открытии панели
        } else {
          const text = errorText(res.error);
          toast(text);
          postToScratch(frameRef.current, {
            source: FROM_PLATFORM, type: "save-result", ok: false, error: text,
          });
        }
      } catch {
        toast(t.errFailed);
        postToScratch(frameRef.current, {
          source: FROM_PLATFORM, type: "save-result", ok: false, error: t.errFailed,
        });
      } finally {
        savingRef.current = false;
        setStatus(null);
      }
    },
    [t, toast, frameRef, refresh, errorText],
  );

  const openProject = useCallback(
    async (p: ScratchProject) => {
      setStatus(t.opening);
      try {
        const url = await getScratchProjectUrl(p.id);
        if (!url) { toast(t.errOpenFailed); return; }
        const res = await fetch(url);
        if (!res.ok) { toast(t.errOpenFailed); return; }
        const sb3 = await res.arrayBuffer();
        activeIdRef.current = p.id;

        if (readyRef.current) {
          postToScratch(frameRef.current, { source: FROM_PLATFORM, type: "load", name: p.name, sb3 });
          toast(t.openedOk);
          setPanelOpen(false);
        } else {
          // Редактор ещё не отозвался — отдадим, как только скажет ready.
          pendingLoadRef.current = { name: p.name, sb3 };
          toast(t.notReady);
        }
      } catch {
        toast(t.errOpenFailed);
      } finally {
        setStatus(null);
      }
    },
    [t, toast, frameRef],
  );

  const removeProject = useCallback(
    async (p: ScratchProject) => {
      setConfirming(null);
      try {
        const res = await deleteScratchProject(p.id);
        if (!res.ok) { toast(t.errDeleteFailed); return; }
        if (activeIdRef.current === p.id) activeIdRef.current = null;
        toast(t.deletedOk);
        await refresh();
      } catch {
        toast(t.errDeleteFailed);
      }
    },
    [t, toast, refresh],
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const msg = parseScratchMessage(e);
      if (!msg) return;

      if (msg.type === "ready") {
        readyRef.current = true;
        const pending = pendingLoadRef.current;
        if (pending) {
          pendingLoadRef.current = null;
          postToScratch(frameRef.current, {
            source: FROM_PLATFORM, type: "load", name: pending.name, sb3: pending.sb3,
          });
          toast(t.openedOk);
          setPanelOpen(false);
        }
        return;
      }
      if (msg.type === "my-projects") { openPanel(); return; }
      void handleSave(msg);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleSave, openPanel, frameRef, toast, t]);

  const sizeText = (bytes: number | null): string | null => {
    if (bytes === null) return null;
    return bytes < 1024 * 1024
      ? format(t.unitKb, { n: Math.max(1, Math.round(bytes / 1024)) })
      : format(t.unitMb, { n: (bytes / (1024 * 1024)).toFixed(1) });
  };

  const originText = (o: ScratchProject["origin"]): string =>
    o === "lesson" ? t.originLesson : o === "homework" ? t.originHomework : t.originSandbox;

  const dateText = (iso: string): string =>
    new Date(iso).toLocaleDateString(LOCALE_TAG[locale as Locale] ?? LOCALE_TAG.ru, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Наша полоса над редактором. Родные кнопки живут внутри рамки, здесь
          только то, чего у редактора нет: вход в список и текущее состояние. */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={openPanel}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          <FolderOpen className="h-4 w-4" />
          {t.myWorks}
        </button>
        {status && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {status}
          </span>
        )}
      </div>

      {/* Рамка редактора — приходит извне, своей здесь нет. */}
      {children}

      {panelOpen && (
        <>
          <div
            className="absolute inset-0 z-20 bg-black/30"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.worksTitle}</h3>
                {projects !== null && (
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {format(t.countLabel, { n: projects.length, limit: SCRATCH_PROJECT_LIMIT })}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label={t.closePanel}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {listBusy && projects === null ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : projects && projects.length === 0 ? (
                // Пустой экран объясняет, что делать, а не просто молчит.
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <FolderOpen className="h-10 w-10 text-slate-300" />
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.emptyTitle}</h4>
                  <p className="max-w-xs text-[13px] leading-snug text-slate-500">{t.emptyBody}</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(projects ?? []).map((p) => {
                    const size = sizeText(p.sizeBytes);
                    return (
                      <li
                        key={p.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{p.name}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {originText(p.origin)} · {dateText(p.updatedAt)}
                              {size ? ` · ${size}` : ""}
                            </p>
                            {p.sharedWithClass && (
                              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                <Share2 className="h-3 w-3" />
                                {t.sharedBadge}
                              </span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={() => void openProject(p)}
                              className="rounded-xl bg-blue-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700"
                            >
                              {t.openBtn}
                            </button>
                            <button
                              onClick={() => setConfirming(p)}
                              aria-label={t.deleteBtn}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}

      {confirming && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {format(t.deleteConfirm, { name: confirming.name })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancelBtn}
              </button>
              <button
                onClick={() => void removeProject(confirming)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                {t.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
