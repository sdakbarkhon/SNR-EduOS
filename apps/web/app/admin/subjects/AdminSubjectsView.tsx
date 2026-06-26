"use client";

import { useState, useEffect, useTransition } from "react";
import { Library, Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { getDictionary, SUBJECT_DEFAULTS, type SubjectWithGroup } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";

type Group    = { id: string; name: string; subject: string };
type Teacher  = { id: string; full_name: string };

type ModalState =
  | { mode: "none" }
  | { mode: "add" }
  | { mode: "edit"; subject: SubjectWithGroup }
  | { mode: "delete"; subject: SubjectWithGroup };

const ICON_OPTIONS = [
  "Calculator","BookOpen","Globe","Languages","BookText","Scroll",
  "Map","Leaf","Atom","FlaskConical","Monitor","Code","Bot",
  "Dumbbell","Music","Palette","Hammer","TreePine","Library",
];

const COLOR_OPTIONS = [
  "#F5A623","#EF4444","#F97316","#F0556B","#F43F5E","#B5793A",
  "#14B8A6","#2DBE7E","#39B6F5","#9B5DE5","#7A4DFF","#0EA5E9",
  "#2D5BFF","#EC4899","#8B5CF6","#71717A","#16A34A","#64748B",
];

export function AdminSubjectsView({
  groups,
  teachers,
}: {
  groups: Group[];
  teachers: Teacher[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;
  const db = createClient();

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [subjects, setSubjects] = useState<SubjectWithGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [isPending, startTransition] = useTransition();

  // Form state
  const [formName, setFormName] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formIcon, setFormIcon] = useState("BookOpen");
  const [formColor, setFormColor] = useState("#64748B");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!selectedGroupId) { setSubjects([]); return; }
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)
      .from("subjects")
      .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
      .eq("group_id", selectedGroupId)
      .order("name")
      .then(({ data }: { data: SubjectWithGroup[] | null }) => {
        setSubjects(data ?? []);
        setLoading(false);
      });
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setFormName(""); setFormTeacherId(""); setFormIcon("BookOpen"); setFormColor("#64748B"); setFormError("");
    setModal({ mode: "add" });
  }

  function openEdit(s: SubjectWithGroup) {
    setFormName(s.name); setFormTeacherId(s.teacher_id ?? "");
    setFormIcon(s.icon); setFormColor(s.color); setFormError("");
    setModal({ mode: "edit", subject: s });
  }

  function onNameChange(name: string) {
    setFormName(name);
    const def = SUBJECT_DEFAULTS[name];
    if (def && formIcon === "BookOpen") setFormIcon(def.icon);
    if (def && formColor === "#64748B") setFormColor(def.color);
  }

  function handleSave() {
    if (!formName.trim()) { setFormError("Введите название"); return; }
    if (!selectedGroupId) { setFormError("Выберите группу"); return; }
    setFormError("");
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db2 = db as any;
      if (modal.mode === "add") {
        const { error } = await db2.from("subjects").insert({
          name: formName.trim(),
          group_id: selectedGroupId,
          teacher_id: formTeacherId || null,
          icon: formIcon,
          color: formColor,
        });
        if (error) { setFormError(error.message); return; }
      } else if (modal.mode === "edit") {
        const { error } = await db2.from("subjects").update({
          name: formName.trim(),
          teacher_id: formTeacherId || null,
          icon: formIcon,
          color: formColor,
        }).eq("id", modal.subject.id);
        if (error) { setFormError(error.message); return; }
      }
      setModal({ mode: "none" });
      // Refresh
      const { data } = await db2
        .from("subjects")
        .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
        .eq("group_id", selectedGroupId)
        .order("name");
      setSubjects(data ?? []);
    });
  }

  function handleDelete() {
    if (modal.mode !== "delete") return;
    const id = modal.subject.id;
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db2 = db as any;
      const { error } = await db2.from("subjects").delete().eq("id", id);
      if (error) { alert(error.message); return; }
      setModal({ mode: "none" });
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    });
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Library className="h-5 w-5 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">{d.subjectsTitle}</h1>
        </div>
        {selectedGroupId && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> {d.subjectsAdd}
          </button>
        )}
      </div>

      {/* Group selector */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-zinc-600">Группа</label>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="w-full max-w-sm rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">{d.subjectsSelectGroup}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Subjects list */}
      {selectedGroupId && (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">{d.subjectsEmpty}</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Icon circle */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                    style={{ background: s.color }}
                  >
                    {s.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 truncate">{s.name}</p>
                    <p className="text-xs text-zinc-500">
                      {s.teacher ? s.teacher.full_name : d.subjectsNotAssigned}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-4 w-4 rounded-full ring-1 ring-zinc-200"
                      style={{ background: s.color }}
                      title={s.icon}
                    />
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setModal({ mode: "delete", subject: s })}
                      className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(modal.mode === "add" || modal.mode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-5">
              <h2 className="text-lg font-semibold text-zinc-900">
                {modal.mode === "add" ? d.subjectsAdd : d.subjectsEdit}
              </h2>
              <button onClick={() => setModal({ mode: "none" })} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsName}</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Математика"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsTeacher}</label>
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{d.subjectsNotAssigned}</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsIcon}</label>
                <div className="grid grid-cols-10 gap-1.5">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setFormIcon(icon)}
                      className={cn(
                        "rounded-lg px-1.5 py-1 text-xs font-mono border transition-colors",
                        formIcon === icon
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
                      )}
                      title={icon}
                    >
                      {icon.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500">Выбрано: {formIcon}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsColor}</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormColor(color)}
                      className={cn(
                        "h-7 w-7 rounded-full transition-all",
                        formColor === color ? "ring-2 ring-offset-2 ring-violet-500 scale-110" : "hover:scale-105",
                      )}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-5">
              <button
                onClick={() => setModal({ mode: "none" })}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {modal.mode === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">Удалить предмет?</h2>
            <p className="mb-1 text-sm text-zinc-600">
              {d.subjectsDeleteConfirm
                .replace("{name}", modal.subject.name)
                .replace("{group}", selectedGroup?.name ?? "")}
            </p>
            <p className="mb-5 text-sm text-red-600">{d.subjectsDeleteWarning}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModal({ mode: "none" })}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
