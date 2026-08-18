"use client";

import { useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { costUsd, PRICING_USD_PER_1M, GEMINI_MODEL_FLASH } from "@/lib/ai/config";
import { AI_TASK_VALUES } from "@/lib/ai/usage";

export type AiEventRow = {
  created_at: string;
  task: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  school_id: string | null;
  ok: boolean;
};

type Period = "7" | "30" | "month" | "all";

/** Деньги. Суммы здесь мизерные (тысячные доли цента за обращение), поэтому
 *  до цента не округляем — иначе весь отчёт превратится в столбец нулей. */
function money(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function num(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function AiCostsView({
  events,
  schoolNames,
  usedToday,
  freeLimit,
  legacy,
}: {
  events: AiEventRow[];
  schoolNames: Record<string, string>;
  usedToday: number;
  freeLimit: number;
  legacy: { total: number; from: string | null; to: string | null };
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;

  const [period, setPeriod] = useState<Period>("30");
  const [school, setSchool] = useState("");
  const [task, setTask] = useState("");

  const taskLabel = (key: string): string =>
    (t as unknown as Record<string, string>)[`task_${key}`] ?? key;

  /** Строки с посчитанной ценой — считаем один раз на весь экран. */
  const rows = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        at: new Date(e.created_at),
        inTok: e.input_tokens ?? 0,
        outTok: e.output_tokens ?? 0,
        cost: costUsd(e.model, e.input_tokens ?? 0, e.output_tokens ?? 0),
      })),
    [events],
  );

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "7") return new Date(now.getTime() - 7 * 864e5);
    if (period === "30") return new Date(now.getTime() - 30 * 864e5);
    if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(0);
  }, [period]);

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.at >= periodStart &&
          (!school || r.school_id === school) &&
          (!task || r.task === task),
      ),
    [rows, periodStart, school, task],
  );

  const totals = (list: typeof rows) => ({
    requests: list.length,
    failures: list.filter((r) => !r.ok).length,
    inTok: list.reduce((s, r) => s + r.inTok, 0),
    outTok: list.reduce((s, r) => s + r.outTok, 0),
    cost: list.reduce((s, r) => s + r.cost, 0),
  });

  const all = totals(rows);
  const cur = totals(shown);

  // Этот месяц против прошлого — считается по всем данным, а не по фильтру
  // периода: иначе сравнение месяцев зависело бы от выбранного периода и
  // ничего не значило.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const scoped = rows.filter(
    (r) => (!school || r.school_id === school) && (!task || r.task === task),
  );
  const thisMonth = totals(scoped.filter((r) => r.at >= monthStart));
  const lastMonth = totals(scoped.filter((r) => r.at >= prevStart && r.at < monthStart));

  /** Разбивка по любому ключу — школы и задачи считаются одним и тем же кодом. */
  function breakdown(key: (r: (typeof rows)[number]) => string) {
    const map = new Map<string, { requests: number; inTok: number; outTok: number; cost: number }>();
    for (const r of shown) {
      const k = key(r);
      const acc = map.get(k) ?? { requests: 0, inTok: 0, outTok: 0, cost: 0 };
      acc.requests += 1;
      acc.inTok += r.inTok;
      acc.outTok += r.outTok;
      acc.cost += r.cost;
      map.set(k, acc);
    }
    return [...map.entries()]
      .map(([k, v]) => ({ key: k, ...v, share: cur.cost > 0 ? v.cost / cur.cost : 0, avg: v.requests ? v.cost / v.requests : 0 }))
      .sort((a, b) => b.cost - a.cost || b.requests - a.requests);
  }

  const bySchool = breakdown((r) => r.school_id ?? "");
  const byTask = breakdown((r) => r.task);

  const leftToday = Math.max(0, freeLimit - usedToday);
  const usedPct = Math.min(100, Math.round((usedToday / freeLimit) * 100));

  const flash = PRICING_USD_PER_1M[GEMINI_MODEL_FLASH];

  /** Выгрузка — CSV с разделителем «;» и BOM: так Excel на русской Windows
   *  открывает файл сразу правильно, без мастера импорта. */
  function exportCsv() {
    const head = ["Дата", "Вид задачи", "Модель", "Школа", "Токенов вход", "Токенов выход", "Стоимость USD", "Успех"];
    const lines = shown.map((r) => [
      r.at.toISOString(),
      taskLabel(r.task),
      r.model,
      r.school_id ? (schoolNames[r.school_id] ?? r.school_id) : t.aiNoSchool,
      String(r.inTok),
      String(r.outTok),
      r.cost.toFixed(8),
      r.ok ? "да" : "нет",
    ]);
    const csv = "﻿" + [head, ...lines].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{t.aiTitle}</h1>
      <p className="mt-1 text-sm text-gray-600">{t.aiSubtitle}</p>

      {/* Учёт новый — старых данных в нём нет. Подписано явно, чтобы пустой
          июль не читался как «расходов не было». */}
      <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-[13px] leading-relaxed text-amber-900">
          <p>{t.aiFreshNotice}</p>
          {legacy.total > 0 && (
            <p className="mt-1.5">
              <span className="font-semibold">{t.aiOldCounter}:</span>{" "}
              {num(legacy.total)}
              {legacy.from && legacy.to ? ` (${legacy.from} — ${legacy.to})` : ""}. {t.aiOldCounterHint}
            </p>
          )}
        </div>
      </div>

      {/* Самое полезное число: сколько осталось до бесплатного предела. */}
      <div className="mt-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{t.aiFreeLeft}</p>
        <p className="mt-1 text-3xl font-bold text-violet-700">
          {num(leftToday)} <span className="text-base font-medium text-gray-400">/ {num(freeLimit)}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${usedPct > 90 ? "bg-red-500" : usedPct > 70 ? "bg-amber-500" : "bg-violet-500"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">{t.aiFreeLeftHint.replace("{limit}", num(freeLimit))}</p>
      </div>

      {/* Фильтры */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Select
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={[
            { value: "7", label: t.aiPeriod7 },
            { value: "30", label: t.aiPeriod30 },
            { value: "month", label: t.aiPeriodMonth },
            { value: "all", label: t.aiPeriodAll },
          ]}
        />
        <Select
          value={school}
          onChange={setSchool}
          placeholder={t.aiAllSchools}
          options={Object.entries(schoolNames).map(([id, name]) => ({ value: id, label: name }))}
        />
        <Select
          value={task}
          onChange={setTask}
          placeholder={t.aiAllTasks}
          options={AI_TASK_VALUES.map((k) => ({ value: k, label: taskLabel(k) }))}
        />
        <button
          onClick={exportCsv}
          disabled={shown.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t.aiExport}
        </button>
      </div>

      {/* Итоги */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.aiPeriodSpend} value={money(cur.cost)} hint={`${num(cur.requests)} · ${t.aiRequests.toLowerCase()}`} />
        <Stat label={t.aiTotalSpend} value={money(all.cost)} hint={`${num(all.requests)} · ${t.aiRequests.toLowerCase()}`} />
        <Stat label={t.aiThisMonth} value={money(thisMonth.cost)} hint={`${num(thisMonth.requests)} · ${t.aiRequests.toLowerCase()}`} />
        <Stat label={t.aiLastMonth} value={money(lastMonth.cost)} hint={`${num(lastMonth.requests)} · ${t.aiRequests.toLowerCase()}`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.aiTokensIn} value={num(cur.inTok)} />
        <Stat label={t.aiTokensOut} value={num(cur.outTok)} />
        <Stat
          label={t.aiAvgPerCall}
          value={cur.requests ? money(cur.cost / cur.requests) : "—"}
        />
        <Stat label={t.aiFailures} value={num(cur.failures)} hint={t.aiFailuresHint} />
      </div>

      <Table
        title={t.aiBySchool}
        firstCol={t.aiColSchool}
        rows={bySchool.map((b) => ({
          ...b,
          name: b.key ? (schoolNames[b.key] ?? b.key) : t.aiNoSchool,
        }))}
        labels={t}
        empty={t.aiEmpty}
      />

      <Table
        title={t.aiByTask}
        firstCol={t.aiColTask}
        rows={byTask.map((b) => ({ ...b, name: taskLabel(b.key) }))}
        labels={t}
        empty={t.aiEmpty}
      />

      <p className="mt-5 text-xs text-gray-500">
        {t.aiPriceNote.replace("{in}", `$${flash.input.toFixed(2)}`).replace("{out}", `$${flash.output.toFixed(2)}`)}
      </p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-gray-500">{hint}</p>}
    </div>
  );
}

function Table({
  title,
  firstCol,
  rows,
  labels,
  empty,
}: {
  title: string;
  firstCol: string;
  rows: { name: string; requests: number; inTok: number; outTok: number; cost: number; share: number; avg: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any;
  empty: string;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-violet-100 bg-violet-50/60 text-left text-xs font-semibold uppercase tracking-wide text-violet-700">
              <th className="px-4 py-3">{firstCol}</th>
              <th className="px-4 py-3">{labels.aiColRequests}</th>
              <th className="px-4 py-3">{labels.aiColTokens}</th>
              <th className="px-4 py-3">{labels.aiColCost}</th>
              <th className="px-4 py-3">{labels.aiShare}</th>
              <th className="px-4 py-3">{labels.aiColAvg}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-violet-50 last:border-0 hover:bg-violet-50/40">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{num(r.requests)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {num(r.inTok)} / {num(r.outTok)}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{money(r.cost)}</td>
                <td className="px-4 py-3 text-gray-600">{Math.round(r.share * 100)}%</td>
                <td className="px-4 py-3 text-gray-600">{money(r.avg)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-300"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
