"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Pencil, X, Check } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { updateMark, type MarkKind } from "./actions";
import { ModalPortal } from "@/components/ModalPortal";

export type MarkRow = {
  id: string;
  kind: MarkKind;
  student: string;
  groupId: string | null;
  groupName: string | null;
  subject: string | null;
  at: string;
  value: string;
  numeric: number | null;
};

const ATT = ["present", "absent_excused", "absent_unexcused"] as const;

export function MarksView({
  rows,
  groups,
  subjects,
  /**
   * Школа, в которой идёт работа. Срез 3c, роль менеджера.
   *
   * НЕ ПЕРЕДАНО — ничего не меняется: форма уходит байт в байт прежней,
   * доводы прежние, школу подставляют правила доступа. Так работает админ.
   *
   * ПЕРЕДАНО — школа кладётся в каждую форму и в каждый довод. Так работает
   * менеджер: своей школы у него нет, и подставить её некому.
   */
  schoolId,
}: {
  rows: MarkRow[];
  groups: { id: string; name: string }[];
  subjects: string[];
  schoolId?: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin.marks;

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"" | MarkKind>("");
  const [editing, setEditing] = useState<MarkRow | null>(null);

  const kindLabel: Record<MarkKind, string> = {
    lesson_grade: t.kindLessonGrade,
    attendance: t.kindAttendance,
    homework: t.kindHomework,
    test: t.kindTest,
  };
  const attLabel: Record<string, string> = {
    present: t.attPresent,
    absent_excused: t.attExcused,
    absent_unexcused: t.attUnexcused,
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      (!q || r.student.toLowerCase().includes(q))
      && (!group || r.groupId === group)
      && (!subject || r.subject === subject)
      && (!kind || r.kind === kind));
  }, [rows, query, group, subject, kind]);

  const dirty = query || group || subject || kind;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
      <p className="mt-1 text-sm text-gray-600">{t.subtitle}</p>

      {/* Фильтры: всё в одну строку сверху, без переходов по урокам. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-xl border border-violet-100 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-300"
          />
        </div>
        <Select value={group} onChange={setGroup} placeholder={t.allGroups}
          options={groups.map((g) => ({ value: g.id, label: g.name }))} />
        <Select value={subject} onChange={setSubject} placeholder={t.allSubjects}
          options={subjects.map((s) => ({ value: s, label: s }))} />
        <Select value={kind} onChange={(v) => setKind(v as "" | MarkKind)} placeholder={t.allKinds}
          options={(Object.keys(kindLabel) as MarkKind[]).map((k) => ({ value: k, label: kindLabel[k] }))} />
        {dirty && (
          <button
            onClick={() => { setQuery(""); setGroup(""); setSubject(""); setKind(""); }}
            className="rounded-xl px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            {t.clear}
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">{t.shown.replace("{n}", String(shown.length))}</p>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-violet-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-violet-100 bg-violet-50/60 text-left text-xs font-semibold uppercase tracking-wide text-violet-700">
              <th className="px-4 py-3">{t.colStudent}</th>
              <th className="px-4 py-3">{t.colKind}</th>
              <th className="px-4 py-3">{t.colClass}</th>
              <th className="px-4 py-3">{t.colSubject}</th>
              <th className="px-4 py-3">{t.colDate}</th>
              <th className="px-4 py-3">{t.colValue}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={`${r.kind}:${r.id}`} className="border-b border-violet-50 last:border-0 hover:bg-violet-50/40">
                <td className="px-4 py-3 font-medium text-gray-900">{r.student}</td>
                <td className="px-4 py-3 text-gray-600">{kindLabel[r.kind]}</td>
                <td className="px-4 py-3 text-gray-600">{r.groupName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{r.subject ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {r.at ? new Date(r.at).toLocaleDateString(locale === "en" ? "en-GB" : "ru-RU") : "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {r.kind === "attendance" ? (attLabel[r.value] ?? r.value) : r.value}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.edit}
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                  {rows.length === 0 ? t.empty : t.nothingFound}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDialog
          schoolId={schoolId}
          row={editing}
          labels={{ ...t, kind: kindLabel[editing.kind], att: attLabel }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Select({
  value, onChange, placeholder, options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-violet-300"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function EditDialog({
  row, labels, onClose, schoolId,
}: {
  row: MarkRow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labels: any;
  onClose: () => void;
  /** Школа менеджера. Не передана — школу даёт строка админа. */
  schoolId?: string;
}) {
  const [next, setNext] = useState<string>(row.kind === "attendance" ? row.value : String(row.numeric ?? ""));
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(false);
    const value = row.kind === "attendance"
      ? next
      : next.trim() === "" ? null : Number(next);
    start(async () => {
      const res = await updateMark(row.kind, row.id, value, schoolId);
      if (res.ok) onClose();
      else setError(true);
    });
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-bold text-gray-800">{labels.editTitle}</p>
            <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">{row.student}</p>
              <p className="mt-0.5">{labels.kind} · {row.groupName ?? "—"} · {row.subject ?? "—"}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{labels.newValue}</p>
              {row.kind === "attendance" ? (
                <div className="space-y-1.5">
                  {ATT.map((s) => (
                    <button
                      key={s}
                      onClick={() => setNext(s)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                        next === s ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {labels.att[s]}
                    </button>
                  ))}
                </div>
              ) : row.kind === "test" ? (
                // type="number" пропускает «e», «+» и «-»: браузер считает их
                // частью числа, поле после них отдаёт пустоту, и админ видит
                // молчаливо несохранённый балл. Здесь принимаются только цифры —
                // всё остальное просто не вводится.
                <input
                  type="text"
                  inputMode="numeric"
                  value={next}
                  onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-300"
                />
              ) : (
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((g) => (
                    <button
                      key={g}
                      onClick={() => setNext(String(g))}
                      className={`h-11 flex-1 rounded-xl text-base font-bold transition-colors ${
                        Number(next) === g ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs font-medium text-red-600">{labels.failed}</p>}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                {labels.cancel}
              </button>
              <button
                onClick={save}
                disabled={pending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {labels.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
