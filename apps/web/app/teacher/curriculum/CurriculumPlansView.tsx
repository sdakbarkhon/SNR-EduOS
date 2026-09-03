"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, AlertTriangle, Search, ChevronRight, BookOpen } from "lucide-react";
import { uploadCurriculumPlanFile, getCurriculumPlanForGroupSubject, getDictionary, format } from "@snr/core";
import type { CurriculumPlanWithTopics, Dictionary, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { PageContainer } from "@/components/PageContainer";
import { FromBookModal } from "./FromBookModal";
import { ModalPortal } from "@/components/ModalPortal";

type GroupItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; group_id: string };

export function CurriculumPlansView({
  plans: initialPlans,
  groups,
  subjects,
  teacherId,
}: {
  plans: CurriculumPlanWithTopics[];
  groups: GroupItem[];
  subjects: SubjectItem[];
  teacherId: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).curriculum;
  // Больше не оптимистично обновляется onSaved — загрузка теперь редиректит
  // на страницу плана сразу после создания (Большой фикс, Блок 6, ЗАДАЧА 1),
  // список этой страницы просто не участвует в том флоу.
  const plans = initialPlans;
  const [uploadModal, setUploadModal] = useState(false);
  const [bookModal, setBookModal] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) =>
      (p.group_name ?? "").toLowerCase().includes(q) ||
      (p.subject_name ?? "").toLowerCase().includes(q),
    );
  }, [plans, query]);

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder={d.searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-white/60 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {/* Два источника плана рядом: готовый файл — и учебник, если готового
            плана нет вовсе. Разбирает их один и тот же механизм. */}
        <button
          onClick={() => setBookModal(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 active:scale-95"
        >
          <BookOpen className="h-4 w-4" /> {d.fromBookBtn}
        </button>
        <button
          onClick={() => setUploadModal(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95"
        >
          <Upload className="h-4 w-4" /> {d.uploadPlan}
        </button>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-sm text-slate-400">
          {plans.length === 0 ? d.listEmpty : d.noResults}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPlans.map((p) => (
            <Link
              key={p.id}
              href={`/teacher/curriculum/${p.id}`}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{p.subject_name}</p>
                <h3 className="mt-1 truncate text-base font-bold text-slate-900">{p.group_name}</h3>
                <p className="mt-2 text-sm text-slate-500">{p.topics.length} {topicWord(p.topics.length, d)}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      )}

      {uploadModal && (
        <UploadPlanModal
          groups={groups}
          subjects={subjects}
          teacherId={teacherId}
          onClose={() => setUploadModal(false)}
        />
      )}

      {bookModal && (
        <FromBookModal
          groups={groups}
          subjects={subjects}
          onClose={() => setBookModal(false)}
        />
      )}
    </PageContainer>
  );
}

// 19.08.2026 — сами слова переехали в словарь, правило склонения осталось
// прежним и не тронуто: узбекский и английский подставят свои формы (у них
// она одна на все числа), русский — три как было.
function topicWord(n: number, d: Dictionary["curriculum"]): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return d.topicWordOne;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return d.topicWordFew;
  return d.topicWordMany;
}

// ── Upload modal ──────────────────────────────────────────────────────────
// Большой фикс, Блок 6, ЗАДАЧА 1 — раньше здесь было 2 шага (форма+блокирующий
// AI-парсинг → редактор тем → сохранить), парсинг занимал 10-30с прямо в
// модалке. Теперь один шаг: файл загружается в Storage → план создаётся сразу
// в status='processing' → редирект на страницу плана, где идёт фоновый
// парсинг с прогресс-баром (см. CurriculumPlanDetailView.tsx). Разбор/правка
// тем происходит ПОСЛЕ, на странице плана (там уже есть полный редактор тем).

function isPdfOrDocxFile(f: File): "pdf" | "docx" | null {
  const name = f.name.toLowerCase();
  if (f.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return "docx";
  return null;
}

function UploadPlanModal({
  groups, subjects, teacherId, onClose,
}: {
  groups: GroupItem[];
  subjects: SubjectItem[];
  teacherId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).curriculum;
  const db = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [groupId, setGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceFileType, setSourceFileType] = useState<"pdf" | "docx" | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [confirmReplace, setConfirmReplace] = useState<CurriculumPlanWithTopics | null>(null);

  const groupSubjects = subjects.filter((s) => s.group_id === groupId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setFile(null); setSourceFileType(null); setFileError(""); return; }
    const kind = isPdfOrDocxFile(f);
    if (!kind) { setFileError(d.errorPdfDocxOnly); setFile(null); setSourceFileType(null); e.target.value = ""; return; }
    if (f.size > 20 * 1024 * 1024) { setFileError(d.errorFileTooLarge); setFile(null); setSourceFileType(null); e.target.value = ""; return; }
    setFileError("");
    setFile(f);
    setSourceFileType(kind);
  }

  async function startUpload(replaceExisting: CurriculumPlanWithTopics | null) {
    if (!file || !sourceFileType || !groupId || !subjectId) return;
    setUploading(true); setUploadError("");
    try {
      const group = groups.find((g) => g.id === groupId);
      const subject = subjects.find((s) => s.id === subjectId);
      const { storagePath } = await uploadCurriculumPlanFile(db, { teacherId, file });
      const res = await fetch("/api/curriculum-plans/create-processing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId, subjectId, storagePath, sourceFileType,
          // НЕ ПЕРЕВОДИТСЯ НАМЕРЕННО: значение уходит в базу названием плана.
          // Переведи — и заголовок в базе станет зависеть от языка того, кто
          // загружал, а у соседа по школе тот же план назовётся иначе.
          title: `${subject?.name ?? "Предмет"} — ${group?.name ?? "Группа"}`,
          replaceExistingId: replaceExisting?.id ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || d.saveError); return; }
      onClose();
      router.push(`/teacher/curriculum/${json.id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : d.saveError);
    } finally {
      setUploading(false);
      setConfirmReplace(null);
    }
  }

  async function handleUploadClick() {
    setUploadError("");
    const existing = await getCurriculumPlanForGroupSubject(db, groupId, subjectId).catch(() => null);
    if (existing) { setConfirmReplace(existing); return; }
    await startUpload(null);
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-900">{d.uploadPlan}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>{d.fieldGroup}</label>
                <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setSubjectId(""); }} className={inputCls}>
                  <option value="">{d.selectGroupPlaceholder}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {groupId && (
                <div>
                  <label className={labelCls}>{d.fieldSubject}</label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                    <option value="">{d.selectSubjectPlaceholder}</option>
                    {groupSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>{d.fieldPlanFile}</label>
                <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500">
                  <FileText className="h-5 w-5" />
                  {file ? file.name : d.pickFileBtn}
                </button>
                {fileError && <p className="mt-1.5 text-[12px] text-red-500">{fileError}</p>}
              </div>
              {uploadError && <p className="text-sm text-red-500">{uploadError}</p>}
              <button
                onClick={handleUploadClick}
                disabled={uploading || !groupId || !subjectId || !file}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? d.uploading : d.uploadPlan}
              </button>
              <p className="text-center text-[11px] text-slate-400">
                {d.uploadHint}
              </p>
            </div>
          </div>
        </div>

        {confirmReplace && (
          <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                <div className="mb-3 flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-base font-bold">{d.planExistsWarning}</h3>
                </div>
                <p className="text-sm text-slate-600">
                  {format(d.replaceConfirm, { n: confirmReplace.topics.length, word: topicWord(confirmReplace.topics.length, d) })}
                  {" "}{d.replaceNote}
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setConfirmReplace(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">{d.cancel}</button>
                  <button onClick={() => startUpload(confirmReplace)} disabled={uploading} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                    {uploading ? d.replacing : d.replace}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    </ModalPortal>
  );
}
