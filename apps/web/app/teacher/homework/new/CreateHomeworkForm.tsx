"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  createTeacherHomework,
  createTestQuestions,
  uploadHomeworkAttachment,
  setHomeworkAttachment,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { FileText, ClipboardList, Trash2, Paperclip, X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type Format = "file" | "test" | null;
type QuestionType = "single_choice" | "open";

interface Option { text: string; isCorrect: boolean }
interface Question { type: QuestionType; text: string; options: Option[] }

interface Props {
  groups: Array<{ id: string; name: string; subject: string }>;
  teacherId: string;
}

export function CreateHomeworkForm({ groups, teacherId }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const supabase = createClient();

  const [format, setFormat] = useState<Format>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_FILE_BYTES = 50 * 1024 * 1024;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) { setError("Файл больше 50 МБ"); e.target.value = ""; return; }
    setError(null);
    setAttachFile(f);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setError("Файл больше 50 МБ"); return; }
    setError(null);
    setAttachFile(f);
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, { type: "single_choice", text: "", options: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }] }]);
  }

  function removeQuestion(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  function setOptionText(qi: number, oi: number, text: string) {
    setQuestions((qs) => qs.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, oidx) => oidx === oi ? { ...o, text } : o) } : q));
  }

  function setCorrectOption(qi: number, oi: number) {
    setQuestions((qs) => qs.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, oidx) => ({ ...o, isCorrect: oidx === oi })) } : q));
  }

  async function save(status: "draft" | "published") {
    if (!title.trim()) { setError("Введите название"); return; }
    if (!groupId) { setError("Выберите группу"); return; }
    if (!deadline) { setError("Укажите дедлайн"); return; }

    // teacherId may be "" if getMyTeacher failed at page load — fetch from auth as fallback
    let resolvedTeacherId = teacherId;
    if (!resolvedTeacherId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Нет активной сессии — войдите снова"); return; }
      const { data: t } = await supabase.from("teachers").select("id").eq("user_id", user.id).single();
      if (!t) { setError("Профиль учителя не найден"); return; }
      resolvedTeacherId = (t as { id: string }).id;
    }

    setSaving(true);
    setError(null);
    try {
      const hw = await createTeacherHomework(supabase, {
        groupId, title: title.trim(), description: description.trim(),
        dueDate: deadline,
        contentType: format === "test" ? "test" : "file",
        teacherId: resolvedTeacherId, status,
      });
      if (format === "test" && questions.length > 0) {
        await createTestQuestions(supabase, hw.id, questions.map((q, i) => ({
          questionText: q.text, questionType: q.type, orderIndex: i,
          options: q.type === "single_choice" ? q.options.map((o, oi) => ({ optionText: o.text, isCorrect: o.isCorrect, orderIndex: oi })) : undefined,
        })));
      }
      if (format === "file" && attachFile) {
        const { path, sizeByte } = await uploadHomeworkAttachment(supabase, {
          teacherId: resolvedTeacherId,
          homeworkId: hw.id,
          fileName: attachFile.name,
          blob: attachFile,
        });
        await setHomeworkAttachment(supabase, hw.id, { path, sizeByte, fileName: attachFile.name });
      }
      router.push("/teacher/homework");
    } catch (e: unknown) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  if (!format) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-[22px] font-bold text-brand-ink">{d.teacher.newHomeworkTitle}</h1>
        </div>
        <p className="text-[15px] text-brand-ink-muted">{d.teacher.step1Title}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-xl">
          <button onClick={() => setFormat("test")}
            className="rounded-[24px] bg-white/70 border border-white/80 backdrop-blur-xl p-6 text-left transition-all hover:bg-white hover:shadow-lg"
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <ClipboardList size={32} className="mb-3 text-violet-500" />
            <div className="text-[18px] font-bold text-brand-ink">{d.teacher.step1Test}</div>
            <div className="mt-1 text-[13px] text-brand-ink-muted">{d.teacher.step1TestDesc}</div>
          </button>
          <button onClick={() => setFormat("file")}
            className="rounded-[24px] bg-white/70 border border-white/80 backdrop-blur-xl p-6 text-left transition-all hover:bg-white hover:shadow-lg"
            style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <FileText size={32} className="mb-3 text-brand-blue" />
            <div className="text-[18px] font-bold text-brand-ink">{d.teacher.step1File}</div>
            <div className="mt-1 text-[13px] text-brand-ink-muted">{d.teacher.step1FileDesc}</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => setFormat(null)} className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[22px] font-bold text-brand-ink">
          {d.teacher.newHomeworkTitle} — {format === "test" ? d.teacher.step1Test : d.teacher.step1File}
        </h1>
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.formName}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.formGroup}</span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.formDesc}</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 resize-none" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.formDeadline}</span>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none" />
        </label>

        {format === "file" && (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-brand-ink-muted">
              {d.teacher.hwAttachLabel} <span className="text-slate-400 font-normal">(опционально)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,video/mp4"
              onChange={handleFileChange}
              className="hidden"
              id="hw-attach"
            />
            {attachFile ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-brand-blue/40 bg-blue-50/60 px-4 py-3">
                <Paperclip size={15} className="shrink-0 text-brand-blue" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-brand-blue">{attachFile.name}</p>
                  <p className="text-[11px] text-slate-500">{(attachFile.size / (1024 * 1024)).toFixed(1)} МБ</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAttachFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="shrink-0 text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label
                htmlFor="hw-attach"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-200 p-6 text-center transition-all hover:border-brand-blue/40 hover:bg-blue-50/20"
              >
                <Paperclip size={20} className="text-slate-400" />
                <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.hwAttachBtn}</span>
                <span className="text-[11px] text-slate-400">PDF, DOCX, PPTX, XLSX, JPG, PNG, MP4 · до 50 МБ</span>
              </label>
            )}
          </div>
        )}
      </div>

      {format === "test" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-brand-ink">Вопросы</h2>
            <button onClick={() => alert(d.teacher.aiStub)}
              className="rounded-[10px] border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-700 transition-all hover:bg-violet-100">
              {d.teacher.aiGenerate}
            </button>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-4 space-y-3"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">{qi + 1}</span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={q.type} onChange={(e) => updateQuestion(qi, { type: e.target.value as QuestionType })}
                      className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[12px] text-brand-ink focus:outline-none">
                      <option value="single_choice">{d.teacher.singleChoice}</option>
                      <option value="open">{d.teacher.openQuestion}</option>
                    </select>
                    <button onClick={() => removeQuestion(qi)} className="ml-auto text-slate-400 hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                    placeholder={d.teacher.questionText}
                    className="w-full rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50" />
                  {q.type === "single_choice" && q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button onClick={() => setCorrectOption(qi, oi)}
                        className={cn("h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                          opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white")} />
                      <input value={opt.text} onChange={(e) => setOptionText(qi, oi, e.target.value)}
                        placeholder={`${d.teacher.addOption} ${oi + 1}`}
                        className="flex-1 rounded-[8px] border border-slate-200 bg-white/80 px-2 py-1.5 text-[13px] text-brand-ink focus:outline-none focus:border-brand-blue/50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <button onClick={addQuestion}
            className="w-full rounded-[14px] border-2 border-dashed border-slate-200 py-3 text-[13px] font-semibold text-brand-ink-muted transition-all hover:border-brand-blue/40 hover:text-brand-blue">
            {d.teacher.addQuestion}
          </button>
        </div>
      )}

      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => save("draft")} disabled={saving}
          className="rounded-[12px] border border-slate-200 bg-white/80 px-5 py-2.5 text-[14px] font-semibold text-brand-ink transition-all hover:bg-white disabled:opacity-50">
          {saving ? d.common.loading : d.teacher.saveDraft}
        </button>
        <button onClick={() => save("published")} disabled={saving}
          className="rounded-[12px] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.35)" }}>
          {saving && attachFile ? d.teacher.hwAttachProgress : saving ? d.common.loading : d.teacher.publish}
        </button>
      </div>
    </div>
  );
}
