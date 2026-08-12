"use client";

/**
 * Общие детали сдачи работы — один набор на классную работу и на домашнее
 * задание.
 *
 * ЗАЧЕМ ОДИН НАБОР. До 12.08.2026 два экрана сдачи вели себя по-разному:
 * на домашнем задании было перетаскивание файла, карточка прикреплённого и
 * кнопка «Пересдать», на классной работе — ничего из этого, а после отправки
 * не было видно даже, какой файл ушёл. Дальше расхождение только росло бы,
 * поэтому детали вынесены сюда, а экраны их собирают.
 *
 * ЗАГРУЗКОЙ В ХРАНИЛИЩЕ ЭТОТ ФАЙЛ НЕ ЗАНИМАЕТСЯ. Путь строит общий помощник
 * `mySchoolStoragePath` (packages/core/src/storage/path.ts) внутри функций
 * ядра — второй копии этой логики здесь нет и быть не должно.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, Check, Download, Loader2, Paperclip, Upload, X } from "lucide-react";

/* ── Размер файла ─────────────────────────────────────────────────────── */

export const MAX_SUBMISSION_BYTES = 50 * 1024 * 1024;

/** «12.4 МБ» / «312 КБ». Совпадает с подписью в учительских экранах. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Типы, которые принимает сдача. Тот же список, что стоял на домашнем
 *  задании, — расширять его тут, а не в двух местах. */
export const SUBMISSION_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "video/mp4",
].join(",");

export type SubmissionKitStrings = {
  dropHint: string;
  dropAction: string;
  fileTooLarge: string;
  fileWrongType: string;
  removeFile: string;
  attachedTitle: string;
  openFile: string;
  openFailed: string;
  stateSaving: string;
  stateSaved: string;
  stateError: string;
  statusDraft: string;
  statusSubmitted: string;
  submittedAt: string;
};

/* ── Растущее поле ответа ─────────────────────────────────────────────── */

/**
 * Textarea, которая растёт под текст.
 *
 * Высота считается по scrollHeight в layout-эффекте — до отрисовки кадра,
 * иначе поле дёргалось бы на каждый символ. Ручное изменение размера
 * отключено: пользователь тянул бы рамку, а следующий ввод её сбрасывал.
 */
export function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  minRows = 4,
  maxRows = 18,
  disabled,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight) || 20;
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const min = lineHeight * minRows + padding;
    const max = lineHeight * maxRows + padding;
    el.style.height = "auto";
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={minRows}
      className={`w-full resize-none ${className}`}
    />
  );
}

/* ── Состояние сохранения ─────────────────────────────────────────────── */

export type SaveState = "idle" | "saving" | "saved" | "error";

/** Подпись «сохраняется / сохранено / ошибка». Пока состояние `idle` —
 *  не рисуется вовсе, чтобы не занимать место до первого действия. */
export function SaveStateNote({ state, t }: { state: SaveState; t: SubmissionKitStrings }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: t.stateSaving, cls: "text-slate-500" },
    saved: { icon: <Check className="h-3 w-3" />, text: t.stateSaved, cls: "text-emerald-600" },
    error: { icon: <AlertCircle className="h-3 w-3" />, text: t.stateError, cls: "text-red-500" },
  } as const;
  const v = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${v.cls}`} role="status">
      {v.icon}
      {v.text}
    </span>
  );
}

/* ── Статус работы ────────────────────────────────────────────────────── */

/** «Черновик» либо «Отправлено · {время}». Время приходит уже строкой:
 *  форматируют его экраны, у ученика и учителя разные форматчики. */
export function SubmissionStatusBadge({
  submitted,
  submittedLabel,
  t,
}: {
  submitted: boolean;
  submittedLabel?: string | null;
  t: SubmissionKitStrings;
}) {
  if (!submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        {t.statusDraft}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <Check className="h-3 w-3" />
      {submittedLabel ? t.submittedAt.replace("{date}", submittedLabel) : t.statusSubmitted}
    </span>
  );
}

/* ── Карточка прикреплённого файла ────────────────────────────────────── */

/**
 * Что именно отправлено: имя, размер и кнопка «Открыть».
 *
 * Ссылку на файл выдаёт `resolveUrl` — подписанный URL живёт недолго, поэтому
 * запрашивается по нажатию, а не при отрисовке списка.
 */
export function AttachedFileCard({
  name,
  sizeBytes,
  resolveUrl,
  t,
}: {
  name: string;
  sizeBytes?: number | null;
  resolveUrl: () => Promise<string | null>;
  t: SubmissionKitStrings;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setBusy(true);
    setFailed(false);
    try {
      const url = await resolveUrl();
      if (!url) {
        setFailed(true);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-2.5">
      <Paperclip size={14} className="flex-shrink-0 text-brand-blue" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700">{name}</p>
        {sizeBytes != null ? <p className="text-[10px] text-slate-400">{formatBytes(sizeBytes)}</p> : null}
        {failed ? <p className="text-[10px] font-medium text-red-500">{t.openFailed}</p> : null}
      </div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
        {t.openFile}
      </button>
    </div>
  );
}

/* ── Выбор файла с перетаскиванием ────────────────────────────────────── */

/**
 * Область загрузки: клик или перетаскивание мышью.
 *
 * Проверки здесь, а не после отправки: размер и тип видно сразу, и ученик
 * получает понятный текст («файл больше 50 МБ»), а не сырую ошибку хранилища
 * через десять секунд ожидания.
 */
export function FileDropZone({
  file,
  onPick,
  disabled,
  t,
  accept = SUBMISSION_ACCEPT,
  maxBytes = MAX_SUBMISSION_BYTES,
}: {
  file: File | null;
  onPick: (file: File | null, error: string | null) => void;
  disabled?: boolean;
  t: SubmissionKitStrings;
  accept?: string;
  maxBytes?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);

  const check = useCallback(
    (f: File | null) => {
      if (!f) {
        onPick(null, null);
        return;
      }
      if (f.size > maxBytes) {
        onPick(null, t.fileTooLarge.replace("{max}", formatBytes(maxBytes)));
        return;
      }
      const allowed = accept.split(",").map((x) => x.trim()).filter(Boolean);
      // Пустой тип отдают некоторые браузеры для редких расширений — такой
      // файл пропускаем: отказать по пустому типу значило бы врать про
      // «не тот тип» там, где тип просто неизвестен.
      if (f.type && allowed.length > 0 && !allowed.includes(f.type)) {
        onPick(null, t.fileWrongType);
        return;
      }
      onPick(f, null);
    },
    [accept, maxBytes, onPick, t],
  );

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-blue/40 bg-blue-50/60 px-4 py-2.5">
        <Paperclip size={14} className="flex-shrink-0 text-brand-blue" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-brand-blue">{file.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          aria-label={t.removeFile}
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            onPick(null, null);
          }}
          className="flex-shrink-0 text-slate-400 hover:text-red-500"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        check(e.dataTransfer.files[0] ?? null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => check(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors disabled:opacity-50 ${
          over ? "border-brand-blue bg-blue-50/70" : "border-slate-300 bg-white/60 hover:border-brand-blue"
        }`}
      >
        <Upload className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-600">{t.dropAction}</span>
        <span className="text-xs text-slate-400">{t.dropHint}</span>
      </button>
    </div>
  );
}

/* ── Локальный черновик ───────────────────────────────────────────────── */

/**
 * Черновик текста в браузере.
 *
 * Отдельной колонки под черновик в базе нет, а терять набранное при
 * случайном обновлении страницы нельзя — поэтому текст живёт в
 * localStorage до отправки. Возвращает состояние сохранения, чтобы экран
 * показал «сохраняется/сохранено».
 */
export function useTextDraft(storageKey: string, submitted: boolean) {
  const [text, setText] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setText(saved);
    } catch {
      // приватный режим — просто работаем без черновика
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loadedRef.current || submitted) return;
    if (text === "") {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* приватный режим */
      }
      setState("idle");
      return;
    }
    setState("saving");
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, text);
        setState("saved");
      } catch {
        setState("error");
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [text, storageKey, submitted]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* приватный режим */
    }
    setState("idle");
  }, [storageKey]);

  return { text, setText, state, setState, clear };
}
