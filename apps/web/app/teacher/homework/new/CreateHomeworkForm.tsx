"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  createTeacherHomework,
  createTestQuestions,
  uploadHomeworkAttachment,
  setHomeworkAttachment,
  uploadHomeworkTestsFile,
  getTeacherLessonsForGroup,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { FileText, ClipboardList, Trash2, Paperclip, X, ChevronLeft, Sparkles, Check, GraduationCap, Code } from "lucide-react";
import { TeacherAIPanel } from "./TeacherAIPanel";
import { cn } from "@/lib/cn";

type Format = "file" | "test" | "learning" | "programming";

const STARTER_PLACEHOLDER: Record<"python" | "cpp", string> = {
  python: "def solve():\n    # Твой код здесь\n    pass\n\nsolve()",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Твой код здесь\n    return 0;\n}",
};
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

  const [format, setFormat] = useState<Format>("file");
  const [testDuration, setTestDuration] = useState(10); // minutes
  const [autoGrade, setAutoGrade] = useState(true);
  const [progLanguage, setProgLanguage] = useState<"python" | "cpp">("python");
  const [starterCode, setStarterCode] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [testsFile, setTestsFile] = useState<File | null>(null);
  const testsRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessonId, setLessonId] = useState<string>("");
  const [lessonsForGroup, setLessonsForGroup] = useState<
    Array<{ id: string; starts_at: string; topic: string | null; lesson_no: number | null }>
  >([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiToast, setAiToast] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    setLessonId("");
    getTeacherLessonsForGroup(supabase, groupId)
      .then(setLessonsForGroup)
      .catch(() => setLessonsForGroup([]));
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleAIApply(data: {
    title: string;
    description: string;
    questions?: Array<{ question: string; options: string[]; correctIndex: number }>;
  }) {
    setTitle(data.title);
    setDescription(data.description);
    if (data.questions && format === "test") {
      setQuestions(
        data.questions.map((q) => ({
          type: "single_choice" as QuestionType,
          text: q.question,
          options: q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctIndex })),
        })),
      );
    }
    setAiPanelOpen(false);
    setAiToast(true);
    setTimeout(() => setAiToast(false), 4000);
  }

  async function save(status: "draft" | "published") {
    if (format === "learning") return; // stub
    if (!title.trim()) { setError("Введите название"); return; }
    if (format === "programming" && !description.trim()) { setError("Введите условие задачи"); return; }
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
        contentType: format === "test" ? "test" : format === "programming" ? "programming" : "file",
        teacherId: resolvedTeacherId,
        lessonId: lessonId || null,
        status,
        testDurationSeconds: format === "test" ? testDuration * 60 : null,
        testAutoGrade: format === "test" ? autoGrade : true,
        programmingLanguage: format === "programming" ? progLanguage : null,
        starterCode: format === "programming" ? (starterCode || null) : null,
        expectedOutput: format === "programming" ? (expectedOutput || null) : null,
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
      if (format === "programming" && testsFile) {
        const { path, sizeByte } = await uploadHomeworkTestsFile(supabase, {
          teacherId: resolvedTeacherId, homeworkId: hw.id, fileName: testsFile.name, blob: testsFile,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("homework").update({
          tests_attachment_path: path, tests_attachment_filename: testsFile.name, tests_attachment_size_bytes: sizeByte,
        }).eq("id", hw.id);
      }
      router.push("/teacher/homework");
    } catch (e: unknown) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  const isStub = format === "learning";
  const TYPE_TABS: Array<{ key: Format; label: string; Icon: typeof FileText }> = [
    { key: "file", label: d.homework.typeFile, Icon: FileText },
    { key: "test", label: d.homework.typeTest, Icon: ClipboardList },
    { key: "learning", label: d.homework.typeLearning, Icon: GraduationCap },
    { key: "programming", label: d.homework.typeProgramming, Icon: Code },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-[22px] font-bold text-brand-ink">
          {d.teacher.newHomeworkTitle}
        </h1>
        {!isStub && (
          <button
            type="button"
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" /> Сгенерировать с ИИ
          </button>
        )}
      </div>

      {/* Type switcher */}
      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => {
          const active = format === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFormat(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all",
                active
                  ? "bg-brand-blue text-white shadow-md shadow-brand-blue/25"
                  : "bg-white/70 border border-slate-200 text-brand-ink-muted hover:bg-white",
              )}
            >
              <t.Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {isStub ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-white/80 bg-white/70 px-6 py-16 text-center backdrop-blur-xl"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
          {format === "learning"
            ? <GraduationCap size={40} className="text-slate-300" />
            : <Code size={40} className="text-slate-300" />}
          <p className="text-[16px] font-bold text-brand-ink">
            {format === "learning" ? d.homework.test.learningStub : d.homework.test.programmingStub}
          </p>
          <p className="max-w-sm text-[13px] text-brand-ink-muted">
            {format === "learning" ? d.homework.test.learningStubSub : d.homework.test.programmingStubSub}
          </p>
        </div>
      ) : (
      <>
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

        {/* Lesson selector */}
        {lessonsForGroup.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.lesson.linkLesson}
            </span>
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none"
            >
              <option value="">{d.lesson.noLesson}</option>
              {lessonsForGroup.map((l) => {
                const dateStr = new Date(l.starts_at).toLocaleDateString("ru", {
                  day: "numeric", month: "short", timeZone: "Asia/Tashkent",
                });
                const label = l.topic
                  ? `${dateStr} · ${l.topic}`
                  : l.lesson_no
                  ? `${dateStr} · Урок №${l.lesson_no}`
                  : dateStr;
                return (
                  <option key={l.id} value={l.id}>{label}</option>
                );
              })}
            </select>
          </label>
        )}

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
          {/* Test settings: duration + auto-grade */}
          <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.test.durationLabel}</span>
              <input type="number" min={1} max={180} value={testDuration}
                onChange={(e) => setTestDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32 rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50" />
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={autoGrade} onChange={(e) => setAutoGrade(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30" />
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-brand-ink">{d.homework.test.autoGradeLabel}</span>
                {autoGrade && (
                  <span className="mt-0.5 block text-[12px] text-brand-ink-muted">{d.homework.test.autoGradeFormula}</span>
                )}
              </span>
            </label>
          </div>
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

      {format === "programming" && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          {/* Language */}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.language}</span>
            <div className="flex gap-2">
              {(["python", "cpp"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setProgLanguage(l)}
                  className={cn("flex items-center gap-2 rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-colors",
                    progLanguage === l ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-brand-ink-muted hover:border-emerald-300")}>
                  <span className={cn("h-3.5 w-3.5 rounded-full border-2", progLanguage === l ? "border-emerald-500 bg-emerald-500" : "border-slate-300")} />
                  {l === "python" ? "Python" : "C++"}
                </button>
              ))}
            </div>
          </div>
          {/* Starter code */}
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.starterLabel}</span>
            <span className="mb-1 text-[11px] text-slate-400">{d.homework.programming.starterHint}</span>
            <textarea rows={6} value={starterCode} onChange={(e) => setStarterCode(e.target.value)}
              placeholder={STARTER_PLACEHOLDER[progLanguage]} spellCheck={false}
              className="rounded-[10px] border border-slate-700 bg-[#1e1e1e] px-3 py-2.5 text-[13px] text-slate-100 resize-none focus:outline-none focus:border-emerald-500/60"
              style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace" }} />
          </label>
          {/* Expected output */}
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.expectedLabel}</span>
            <span className="mb-1 text-[11px] text-slate-400">{d.homework.programming.expectedHint}</span>
            <textarea rows={2} value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
              placeholder="Hello, World!" spellCheck={false}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink resize-none focus:outline-none focus:border-brand-blue/50"
              style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace" }} />
          </label>
          {/* Tests file */}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-brand-ink-muted">
              {d.homework.programming.testsLabel} <span className="font-normal text-slate-400">(опционально)</span>
            </span>
            <input ref={testsRef} type="file" accept=".txt,.json,.py,.cpp,.zip,application/zip,text/plain"
              onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f && f.size > 10 * 1024 * 1024) { setError("Файл больше 10 МБ"); if (testsRef.current) testsRef.current.value = ""; return; } setError(null); setTestsFile(f); }}
              className="hidden" id="prog-tests" />
            {testsFile ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-emerald-400/40 bg-emerald-50/60 px-4 py-3">
                <Paperclip size={15} className="shrink-0 text-emerald-600" />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-emerald-700">{testsFile.name}</p>
                <button type="button" onClick={() => { setTestsFile(null); if (testsRef.current) testsRef.current.value = ""; }} className="shrink-0 text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ) : (
              <label htmlFor="prog-tests" className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-200 p-6 text-center transition-all hover:border-emerald-400/40 hover:bg-emerald-50/20">
                <Paperclip size={18} className="text-slate-400" />
                <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.testsHint}</span>
                <span className="text-[11px] text-slate-400">.txt, .json, .py, .cpp, .zip · до 10 МБ</span>
              </label>
            )}
          </div>
        </div>
      )}
      </>
      )}

      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => save("draft")} disabled={saving || isStub}
          className="rounded-[12px] border border-slate-200 bg-white/80 px-5 py-2.5 text-[14px] font-semibold text-brand-ink transition-all hover:bg-white disabled:opacity-50">
          {saving ? d.common.loading : d.teacher.saveDraft}
        </button>
        <button onClick={() => save("published")} disabled={saving || isStub}
          className="rounded-[12px] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.35)" }}>
          {format === "test" ? d.homework.test.createTest : (saving && attachFile ? d.teacher.hwAttachProgress : saving ? d.common.loading : d.teacher.publish)}
        </button>
      </div>

      <TeacherAIPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        format={format === "test" ? "test" : "file"}
        subject={groups.find((g) => g.id === groupId)?.subject ?? ""}
        onApply={handleAIApply}
      />

      {aiToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[14px] bg-slate-800 px-4 py-3 text-[13px] font-medium text-white shadow-xl">
          <Check className="h-4 w-4 text-green-400" />
          Задание заполнено AI. Проверьте и опубликуйте.
        </div>
      )}
    </div>
  );
}
