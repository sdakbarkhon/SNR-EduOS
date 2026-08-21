"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export type JournalRow = {
  id: number;
  at: string;
  actor_name: string | null;
  action: string;
  outcome: "started" | "done" | "failed" | "denied";
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  ref: number | null;
};

/** Все виды действий — тот же перечень, что закреплён проверкой в миграции
 *  220 и объявлен в lib/superadmin-journal.ts. Порядок задаёт и порядок в
 *  выпадающем списке фильтра. */
const ACTIONS = [
  "school.create", "school.update", "school.archive", "school.delete",
  "admin.create", "admin.update", "admin.delete", "admin.reset_password",
  "self.google_email", "self.password", "access.denied",
] as const;

/**
 * ВРЕМЯ ПОКАЗЫВАЕМ В ТАШКЕНТСКОМ ЧАСОВОМ ПОЯСЕ, ЯВНО.
 *
 * Не ради красоты: сервер на Vercel живёт по UTC, браузер — по +5, и если
 * пояс не назвать, разметка на сервере и в браузере разойдётся. Явный пояс
 * делает обе стороны одинаковыми и заодно показывает человеку то время, в
 * котором он живёт.
 */
const TZ = "Asia/Tashkent";

function когда(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: TZ,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Итог = "ok" | "failed" | "denied";

export function JournalView({
  rows,
  filters,
}: {
  rows: JournalRow[];
  filters: { action: string; from: string; to: string; q: string };
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin;
  const router = useRouter();
  const params = useSearchParams();

  const подпись: Record<string, string> = useMemo(() => ({
    "school.create": t.jActSchoolCreate,
    "school.update": t.jActSchoolUpdate,
    "school.archive": t.jActSchoolArchive,
    "school.delete": t.jActSchoolDelete,
    "admin.create": t.jActAdminCreate,
    "admin.update": t.jActAdminUpdate,
    "admin.delete": t.jActAdminDelete,
    "admin.reset_password": t.jActAdminResetPassword,
    "self.google_email": t.jActSelfGoogleEmail,
    "self.password": t.jActSelfPassword,
    "access.denied": t.jActAccessDenied,
  }), [t]);

  const цель: Record<string, string> = useMemo(() => ({
    school: t.jTargetSchool, admin: t.jTargetAdmin, self: t.jTargetSelf,
  }), [t]);

  /**
   * Строки схлопываются в события.
   *
   * На одно действие в журнале лежит строка «начато», а рядом может лежать
   * вторая — «завершено», «не удалось» или «отказано», — со ссылкой на первую.
   * Человеку нужна одна строка на действие, поэтому пару собираем здесь:
   * ведущая строка это «начато», а её итог берётся из парной. «Начато» без
   * пары означает «выполнено» — если бы действие сорвалось, вторая строка
   * была бы.
   */
  const события = useMemo(() => {
    const пары = new Map<number, JournalRow>();
    for (const r of rows) if (r.ref != null && r.outcome !== "started") пары.set(r.ref, r);

    return rows
      .filter((r) => r.outcome === "started" || r.ref == null)
      .map((r) => {
        const пара = пары.get(r.id);
        const итог: Итог =
          пара?.outcome === "failed" ? "failed"
          : пара?.outcome === "denied" || r.outcome === "denied" ? "denied"
          : "ok";
        const детали = { ...(r.details ?? {}), ...(пара?.outcome === "done" ? (пара.details ?? {}) : {}) };
        const причина = пара && пара.outcome !== "done"
          ? String((пара.details as { reason?: unknown } | null)?.reason ?? "")
          : "";
        return { r, итог, детали, причина };
      });
  }, [rows]);

  function применить(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    router.push(`/superadmin/journal?${next.toString()}`);
  }

  const цвет: Record<Итог, string> = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
    denied: "bg-amber-50 text-amber-800 border-amber-200",
  };
  const словоИтога: Record<Итог, string> = {
    ok: t.jOutcomeOk, failed: t.jOutcomeFailed, denied: t.jOutcomeDenied,
  };

  const поле = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200";

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-[22px] font-bold text-gray-900">{t.jTitle}</h1>
      <p className="mt-1 text-[13px] text-gray-500">{t.jSubtitle}</p>

      {/* Обязательная оговорка: журнал знает только про кнопки этого
          интерфейса. Без неё пустой список читался бы как «ничего не делали»,
          хотя прав на запись у суперадмина в 54 таблицы, где экрана нет. */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p className="text-[12px] leading-relaxed text-sky-900">{t.jNotice}</p>
      </div>

      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          применить({
            action: String(fd.get("action") ?? ""),
            from: String(fd.get("from") ?? ""),
            to: String(fd.get("to") ?? ""),
            q: String(fd.get("q") ?? "").trim(),
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.jFilterAction}</span>
          <select name="action" defaultValue={filters.action} className={поле}>
            <option value="">{t.jFilterAll}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{подпись[a]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.jFilterFrom}</span>
          <input type="date" name="from" defaultValue={filters.from} className={поле} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.jFilterTo}</span>
          <input type="date" name="to" defaultValue={filters.to} className={поле} />
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.jSearch}</span>
          <input name="q" defaultValue={filters.q} placeholder={t.jSearchHint} className={поле} />
        </label>
        <button type="submit" className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-900">
          {t.jApply}
        </button>
        <button
          type="button"
          onClick={() => router.push("/superadmin/journal")}
          className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {t.jReset}
        </button>
      </form>

      <p className="mt-4 text-[12px] text-gray-500">{t.jShown.replace("{n}", String(события.length))}</p>

      <div className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{t.jColWhen}</th>
              <th className="px-4 py-3">{t.jColWho}</th>
              <th className="px-4 py-3">{t.jColWhat}</th>
              <th className="px-4 py-3">{t.jColTarget}</th>
              <th className="px-4 py-3">{t.jColResult}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {события.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  {filters.action || filters.from || filters.to || filters.q ? t.jEmptyFiltered : t.jEmpty}
                </td>
              </tr>
            )}
            {события.map(({ r, итог, детали, причина }) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{когда(r.at)}</td>
                <td className="px-4 py-3 text-gray-800">{r.actor_name || "—"}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{подпись[r.action] ?? r.action}</td>
                <td className="px-4 py-3 text-gray-700">
                  {r.target_type ? (
                    <>
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        {цель[r.target_type] ?? r.target_type}
                      </span>
                      <br />
                      {r.target_name || r.target_id || t.jTargetNone}
                    </>
                  ) : t.jTargetNone}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-bold ${цвет[итог]}`}>
                    {словоИтога[итог]}
                  </span>
                  {причина && (
                    <p className="mt-1 text-[11px] text-gray-500">{t.jReason}: {причина}</p>
                  )}
                  {Object.keys(детали).length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-violet-600">{t.jDetails}</summary>
                      <pre className="mt-1 max-w-[420px] overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-2 text-[11px] text-gray-600">
                        {JSON.stringify(детали, null, 1)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
