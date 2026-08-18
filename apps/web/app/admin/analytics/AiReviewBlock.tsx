"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Разбор аналитики от ИИ.
 *
 * НЕ ГРУЗИТСЯ САМ ПРИ ОТКРЫТИИ ЭКРАНА. Первый заход показывает кнопку
 * «Показать разбор». Причина простая: экран аналитики открывают и ради таблиц,
 * а каждое автоматическое обращение к модели — деньги. Сервер к тому же
 * отдаёт сохранённый разбор, если числа не изменились (см. роут), так что
 * повторное нажатие обычно бесплатно.
 *
 * КОМУ ВИДНО. Компонент живёт только на экране админки; роут отдельно
 * проверяет роль, а правило чтения в базе (миграция 211) отдаёт строку лишь
 * администратору своей школы. Ученик и родитель этого не видят ни на одном
 * экране.
 */
export function AiReviewBlock() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const [text, setText] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [enoughData, setEnoughData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  async function load(force: boolean) {
    setBusy(true);
    setError(null);
    setOpened(true);
    try {
      const res = await fetch("/api/admin/analytics-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || t.anAiFailed); return; }
      setText(json.text as string);
      setGeneratedAt(json.generatedAt as string);
      setEnoughData(json.enoughData !== false);
    } catch {
      setError(t.anAiFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Sparkles className="h-4 w-4 text-violet-600" />
            {t.anAiTitle}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{t.anAiHint}</p>
        </div>
        {opened && text && (
          <button
            onClick={() => load(true)}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {t.anAiRefresh}
          </button>
        )}
      </div>

      {!opened ? (
        <button
          onClick={() => load(false)}
          className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t.anAiShow}
        </button>
      ) : busy && !text ? (
        <p className="mt-3 text-sm text-gray-400">{t.anAiLoading}</p>
      ) : error ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : text ? (
        <>
          {/* Данных мало — предупреждение стоит НАД текстом, а не под ним:
              читать разбор нужно уже зная, что он осторожный. */}
          {!enoughData && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t.anAiLittle}
            </p>
          )}
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">
            {text.split("\n").filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          {generatedAt && (
            <p className="mt-3 text-[11px] text-gray-400">
              {t.anAiGenerated.replace("{when}", new Date(generatedAt).toLocaleString(locale === "en" ? "en-GB" : "ru-RU"))}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
