"use client";

/**
 * ПРОБНАЯ карточка песочницы: редактор Polotno внутри нашей страницы.
 * 16.08.2026, заход «попробовать Polotno».
 *
 * ЧТО ЭТО. Конструктор в духе Canva: слева панель с шаблонами, текстом,
 * фигурами и загрузкой картинок, в центре холст, сверху панель свойств. В
 * отличие от Scratch, здесь НЕТ рамки с чужим адресом — это обычный React,
 * который живёт в нашем бандле и в нашем DOM. Поэтому и мост сообщений не
 * нужен: сохранение вызывается прямо, серверным действием.
 *
 * ПОЧЕМУ ФАЙЛ ЛЕЖИТ В components, А НЕ В app. Так требует их документация для
 * Next.js: компонент подключается через `dynamic(..., { ssr: false })`, и
 * держать его внутри app-каталога нельзя — иначе Next попробует отрисовать его
 * на сервере, а Polotno этого не переживает (ему нужны canvas и window).
 *
 * КЛЮЧ. Polotno платный: 60 дней на пробу, дальше подписка. Ключ по умолчанию —
 * ПУБЛИЧНЫЙ демонстрационный ключ из их же официального примера для Next.js
 * (github.com/polotno-project/polotno-next). Свой ключ школы подставляется
 * переменной окружения NEXT_PUBLIC_POLOTNO_KEY без правки кода.
 *
 * ЧТО СОЗНАТЕЛЬНО ВЫКЛЮЧЕНО. Из панели убраны разделы «Фото» и «Видео»: они
 * ищут по чужим фотостокам и отдают ребёнку что угодно из интернета без
 * фильтра. Остались шаблоны, текст, фигуры, загрузка своих файлов, фон,
 * размер, слои и рисование.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Toolbar } from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";
import { SidePanel, DEFAULT_SECTIONS, type Section } from "polotno/side-panel";
import { Workspace } from "polotno/canvas/workspace";
import { createStore } from "polotno/model/store";
import { setTranslations } from "polotno/config";
import "polotno/ui.css";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";
import { useToast } from "@/components/Toast";
import {
  deletePolotnoProject,
  getPolotnoProjectJson,
  listPolotnoProjects,
  savePolotnoProject,
  type PolotnoProject,
} from "@/app/(app)/projects/polotno/actions";
import { POLOTNO_TEMPLATES } from "./templates";
import { POLOTNO_TRANSLATIONS } from "./translations";

/** Публичный демо-ключ из официального примера Polotno для Next.js. */
const DEMO_KEY = "nFA5H9elEytDyPyvKL7T";
const KEY = process.env.NEXT_PUBLIC_POLOTNO_KEY || DEMO_KEY;

/**
 * Store создаётся один раз на загрузку модуля, а не на каждый показ: так работа
 * ребёнка не пропадает, если он свернул редактор и открыл его заново. Модуль
 * подключается только на клиенте (ssr: false), поэтому верхний уровень
 * безопасен.
 */
const store = createStore({ key: KEY, showCredit: true });
if (store.pages.length === 0) store.addPage();

/** Разделы панели без чужих фотостоков — см. шапку файла. */
const SECTIONS: Section[] = DEFAULT_SECTIONS.filter(
  (s) => s.name !== "photos" && s.name !== "videos",
);

export default function PolotnoEditor() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.sandbox.polotno;
  const toast = useToast();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "save" | "open" | "png">(null);
  const [listOpen, setListOpen] = useState(false);
  const [works, setWorks] = useState<PolotnoProject[] | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Подписи редактора на языке интерфейса. Polotno переводится словарём:
  // отдаём свой при каждой смене языка, недостающие ключи остаются английскими.
  useEffect(() => {
    const pack = POLOTNO_TRANSLATIONS[locale as Locale];
    if (pack) setTranslations(pack);
  }, [locale]);

  const openList = useCallback(async () => {
    setListOpen(true);
    setWorks(null);
    const rows = await listPolotnoProjects();
    if (mounted.current) setWorks(rows);
  }, []);

  /** Сохранить: проект — JSON, картинка — PNG. Оба уходят одним действием. */
  const save = useCallback(async () => {
    if (busy) return;
    setBusy("save");
    try {
      const json = JSON.stringify(store.toJSON());
      const fd = new FormData();
      fd.set("json", new File([json], "project.json", { type: "application/json" }));
      fd.set("name", name.trim() || t.untitled);
      if (projectId) fd.set("projectId", projectId);

      // Снимок первой страницы. Если не отрисовался — сохраняем без него:
      // терять работу из-за картинки нельзя.
      try {
        const dataUrl = await store.toDataURL({ pixelRatio: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        fd.set("png", new File([blob], "preview.png", { type: "image/png" }));
      } catch (e) {
        console.error("[polotno] снимок не получился:", e);
      }

      const res = await savePolotnoProject(fd);
      if (!mounted.current) return;
      if (res.ok) {
        setProjectId(res.id);
        toast(t.savedOk);
      } else {
        const map: Record<string, string> = {
          not_student: t.errNotStudent,
          too_big: t.errTooBig,
          limit: t.errLimit,
          failed: t.errFailed,
        };
        toast(map[res.error] ?? t.errFailed);
      }
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [busy, name, projectId, t, toast]);

  /** Открыть свою работу обратно в редакторе. */
  const open = useCallback(async (row: PolotnoProject) => {
    if (busy) return;
    setBusy("open");
    try {
      const json = await getPolotnoProjectJson(row.id);
      if (!json) {
        toast(t.errOpenFailed);
        return;
      }
      store.loadJSON(JSON.parse(json));
      setProjectId(row.id);
      setName(row.name);
      setListOpen(false);
      toast(t.openedOk);
    } catch (e) {
      console.error("[polotno] открыть не удалось:", e);
      toast(t.errOpenFailed);
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [busy, t, toast]);

  const remove = useCallback(async (row: PolotnoProject) => {
    if (!window.confirm(t.deleteConfirm.replace("{name}", row.name))) return;
    const res = await deletePolotnoProject(row.id);
    if (!res.ok) {
      toast(t.errDeleteFailed);
      return;
    }
    if (projectId === row.id) setProjectId(null);
    toast(t.deletedOk);
    void openList();
  }, [openList, projectId, t, toast]);

  /** Скачать картинку себе на устройство — родная возможность редактора. */
  const downloadPng = useCallback(async () => {
    setBusy("png");
    try {
      await store.saveAsImage({ fileName: `${name.trim() || t.untitled}.png` });
    } catch (e) {
      console.error("[polotno] скачать картинку не удалось:", e);
      toast(t.errFailed);
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, [name, t, toast]);

  /** Начать с готовой заготовки — наши шаблоны, не их галерея. */
  const applyTemplate = useCallback((id: string) => {
    const tpl = POLOTNO_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    store.loadJSON(tpl.json);
    setProjectId(null);
    setName(t.templateNames[tpl.id] ?? "");
  }, [t]);

  const sizeLabel = useMemo(
    () => (works ? t.countLabel.replace("{n}", String(works.length)) : ""),
    [works, t],
  );

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Наша панель над редактором — то же место, что у Scratch. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-3 py-2">
        <span className="rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
          {t.trialBadge}
        </span>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
        />

        <select
          onChange={(e) => { applyTemplate(e.target.value); e.currentTarget.selectedIndex = 0; }}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
          aria-label={t.templates}
        >
          <option value="">{t.templates}</option>
          {POLOTNO_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>{t.templateNames[tpl.id] ?? tpl.id}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "save" ? t.saving : t.saveBtn}
        </button>
        <button
          type="button"
          onClick={() => void downloadPng()}
          disabled={busy !== null}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          {t.downloadBtn}
        </button>
        <button
          type="button"
          onClick={() => void openList()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
        >
          {t.myWorks}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <PolotnoContainer className="polotno-app-container" style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={store} sections={SECTIONS} defaultSection="templates" />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar store={store} downloadButtonEnabled />
            <Workspace store={store} />
            <ZoomButtons store={store} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>

      {/* Список своих работ — поверх редактора, чтобы не потерять несохранённое. */}
      {listOpen && (
        <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="font-bold text-slate-900">{t.worksTitle}</h3>
              {sizeLabel && <p className="text-[11px] text-slate-500">{sizeLabel}</p>}
            </div>
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600"
            >
              {t.closePanel}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {works === null ? (
              <p className="p-4 text-center text-sm text-slate-500">{t.loading}</p>
            ) : works.length === 0 ? (
              <div className="p-4 text-center">
                <p className="font-semibold text-slate-700">{t.emptyTitle}</p>
                <p className="mt-1 text-[12px] leading-snug text-slate-500">{t.emptyBody}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {works.map((row) => (
                  <li key={row.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="truncate font-semibold text-slate-900">{row.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {new Date(row.updatedAt).toLocaleString(locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : "ru-RU")}
                      {row.sizeBytes != null && ` · ${t.unitKb.replace("{n}", String(Math.max(1, Math.round(row.sizeBytes / 1024))))}`}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void open(row)}
                        disabled={busy !== null}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {busy === "open" ? t.opening : t.openBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700"
                      >
                        {t.deleteBtn}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
