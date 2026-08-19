"use client";

import { useRef, useState } from "react";
import { ImageOff, Upload, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { origName, SCHOOL_CARD_FIELDS } from "@/lib/form-patch";

/**
 * Поля карточки школы — одна форма на создание и на правку.
 *
 * ПОЧЕМУ ОДНА. Создание и правка отличаются ровно двумя вещами: заголовком и
 * тем, есть ли уже логотип. Две отдельные формы разошлись бы через месяц, и
 * поле, добавленное в одну, забыли бы в другой.
 *
 * ЛОГОТИП ПРОВЕРЯЕТСЯ ЗДЕСЬ И НА СЕРВЕРЕ. Здесь — чтобы человек узнал о
 * негодном файле сразу, не отправляя два мегабайта впустую. На сервере — потому
 * что проверка в браузере обходится, и она ничего не гарантирует. Третий рубеж
 * стоит на самом бакете. Все три знают одни и те же числа: 2 МБ и три формата.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const MIME = ["image/png", "image/jpeg", "image/webp"];

export type SchoolCardValues = {
  name?: string;
  /** Код может быть пустым у школ, заведённых до того, как он стал
   *  обязательным — форма должна открываться и в этом случае. */
  code?: string | null;
  autostart_enabled?: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  director_name?: string | null;
  website?: string | null;
  legal_details?: string | null;
  /** Подписанная ссылка на текущий логотип, если он есть. */
  logoUrl?: string | null;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
      {hint && <span className="text-[11px] leading-snug text-gray-400">{hint}</span>}
    </div>
  );
}

const inputCls =
  "rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function SchoolCardForm({
  values,
  onLocalError,
}: {
  values: SchoolCardValues;
  /** Отказ по файлу, замеченный до отправки. Показывает вызывающий экран — тем
   *  же способом, что и отказы сервера, чтобы сообщения не выглядели по-разному. */
  onLocalError: (msg: string | null) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;
  const e = d.adminErrors;

  const fileRef = useRef<HTMLInputElement>(null);
  // Предпросмотр выбранного файла. Показывается вместо старого логотипа сразу
  // при выборе — иначе непонятно, что именно уйдёт при сохранении.
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const shownLogo = removed ? null : (preview ?? values.logoUrl ?? null);

  function pick(file: File | undefined) {
    onLocalError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      onLocalError(
        e.logoTooBig
          .replace("{got}", String(Math.round((file.size / 1024 / 1024) * 10) / 10))
          .replace("{max}", "2"),
      );
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!MIME.includes(file.type)) {
      onLocalError(e.logoBadType.replace("{got}", file.type || "?"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setRemoved(false);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-4">
      <Field label={t.fieldSchoolName}>
        <input name="name" required defaultValue={values.name ?? ""} placeholder="SNR International School" className={inputCls} />
      </Field>
      <Field label={t.fieldSchoolCode}>
        <input name="code" required defaultValue={values.code ?? ""} placeholder="SNR-REAL" autoCapitalize="none" className={inputCls} />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-gray-700">
        <input
          type="checkbox"
          name="autostart_enabled"
          defaultChecked={values.autostart_enabled ?? true}
          className="h-4 w-4 rounded border-gray-300 text-slate-700 focus:ring-slate-400"
        />
        {t.autostartLabel}
      </label>

      {/* ── Логотип ─────────────────────────────────────────────────────── */}
      <Field label={t.fieldLogo} hint={t.logoHint}>
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <ImageOff className="h-5 w-5 text-gray-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept={MIME.join(",")}
              onChange={(ev) => pick(ev.target.files?.[0])}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {shownLogo ? t.logoReplace : t.logoChoose}
              </button>
              {shownLogo && (
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setRemoved(true);
                    onLocalError(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.logoRemove}
                </button>
              )}
            </div>
            {!shownLogo && <p className="mt-1.5 text-[11px] text-gray-400">{t.logoNone}</p>}
          </div>
        </div>
        {/* Отметка «убрать» уезжает на сервер полем формы: без неё сервер не
            отличит «логотип не трогали» от «логотип попросили убрать». */}
        {removed && <input type="hidden" name="logo_remove" value="on" />}
      </Field>

      {/* ── Организация ─────────────────────────────────────────────────── */}
      <p className="pt-1 text-xs font-bold uppercase tracking-wide text-gray-400">{t.sectionOrg}</p>

      <Field label={t.fieldDirector}>
        {/* Скрытые исходные значения: по ним сервер отличит «не трогал» от
            «стёр нарочно» и не затрёт заполненное поле пустым. Разбор —
            lib/form-patch.ts. При создании школы values пуст, скрытые поля
            уезжают пустыми, и все шесть колонок пишутся как раньше. */}
        {SCHOOL_CARD_FIELDS.map((f) => (
          <input key={f} type="hidden" name={origName(f)} defaultValue={values[f] ?? ""} />
        ))}
        <input name="director_name" defaultValue={values.director_name ?? ""} className={inputCls} />
      </Field>
      <Field label={t.fieldAddress}>
        <input name="address" defaultValue={values.address ?? ""} className={inputCls} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.fieldPhone}>
          <input name="phone" type="tel" defaultValue={values.phone ?? ""} className={inputCls} />
        </Field>
        <Field label={t.fieldEmail}>
          <input name="email" type="email" defaultValue={values.email ?? ""} autoCapitalize="none" className={inputCls} />
        </Field>
      </div>
      <Field label={t.fieldWebsite}>
        <input name="website" defaultValue={values.website ?? ""} placeholder="https://" autoCapitalize="none" className={inputCls} />
      </Field>
      <Field label={t.fieldLegalDetails} hint={t.legalDetailsHint}>
        <textarea name="legal_details" rows={4} defaultValue={values.legal_details ?? ""} className={`${inputCls} resize-y`} />
      </Field>
    </div>
  );
}
