"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  createTeacherHomework,
  createTestQuestions,
  createHomeworkSubtasks,
  uploadHomeworkAttachment,
  setHomeworkAttachment,
  uploadHomeworkTestsFile,
  uploadHomeworkHint,
  setHomeworkHint,
  getTeacherLessonsForGroup,
  linkedMaterialAttachmentPath,
  linkedBookAttachmentPath,
} from "@snr/core";
import type { Locale, HomeworkSubtaskType, ContentType, CodeLanguage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { FileText, ClipboardList, Trash2, Paperclip, X, ChevronLeft, Check, Code, Layers, GripVertical, Puzzle, Globe, AlertCircle, FolderSearch } from "lucide-react";
import { KnowledgeBaseFilePicker, type PickedKnowledgeBaseFile } from "@/components/KnowledgeBaseFilePicker";
import { HomeworkAiGenerateModal, type GeneratedHomework } from "./HomeworkAiGenerateModal";
import { EduOSAiIcon } from "@/components/EduOSAiIcon";
import { CodeEditor } from "@/components/CodeEditor";
import { cn } from "@/lib/cn";
import { SERVICE_CONFIG, isExternalService, validateServiceUrl, EXTERNAL_SERVICE_ORDER, getServicesForSubject } from "@/lib/external-services";
import { CODE_LANGUAGES, CODE_LANGUAGE_LABELS, isHtmlLanguage } from "@/lib/code-languages";

type Format = ContentType;
type QuestionType = "single_choice" | "open";

interface Option { text: string; isCorrect: boolean }
interface Question { type: QuestionType; text: string; options: Option[] }
interface Subtask { type: HomeworkSubtaskType; title: string; description: string; config: Record<string, unknown> }

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
  const [progLanguage, setProgLanguage] = useState<CodeLanguage>("python");
  const [starterCode, setStarterCode] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalUrlError, setExternalUrlError] = useState<string | null>(null);
  const [testsFile, setTestsFile] = useState<File | null>(null);
  const testsRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessonId, setLessonId] = useState<string>("");
  const [lessonsForGroup, setLessonsForGroup] = useState<
    Array<{ id: string; starts_at: string; topic: string | null; title: string | null; lesson_no: number | null; subjectName: string | null }>
  >([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 8.1 — hint image/PDF, independent of format
  // (unlike attachFile which only applies to content_type='file').
  const [hintFile, setHintFile] = useState<File | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);
  const hintRef = useRef<HTMLInputElement>(null);
  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 3.4 — attach an existing Knowledge Base file
  // instead of uploading a fresh copy. Mutually exclusive with attachFile.
  const [pickedFromKB, setPickedFromKB] = useState<PickedKnowledgeBaseFile | null>(null);
  const [showKBPicker, setShowKBPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);

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

  const HINT_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"];

  function handleHintFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && !HINT_MIME_TYPES.includes(f.type)) { setHintError(d.teacher.hwHintInvalidType); e.target.value = ""; return; }
    if (f && f.size > MAX_FILE_BYTES) { setHintError("Файл больше 50 МБ"); e.target.value = ""; return; }
    setHintError(null);
    setHintFile(f);
  }

  function handleHintFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!HINT_MIME_TYPES.includes(f.type)) { setHintError(d.teacher.hwHintInvalidType); return; }
    if (f.size > MAX_FILE_BYTES) { setHintError("Файл больше 50 МБ"); return; }
    setHintError(null);
    setHintFile(f);
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

  function addSubtask(type: HomeworkSubtaskType) {
    setSubtasks((ts) => ts.length >= 10 ? ts : [...ts, { type, title: "", description: "", config: {} }]);
  }

  function removeSubtask(i: number) {
    setSubtasks((ts) => ts.filter((_, idx) => idx !== i));
  }

  function updateSubtask(i: number, patch: Partial<Subtask>) {
    setSubtasks((ts) => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  function handleAiGenerateApply(data: GeneratedHomework) {
    setTitle(data.title);
    setDescription(data.description);
    if (format === "test" && data.config?.questions) {
      setQuestions(
        data.config.questions.map((q) => ({
          type: "single_choice" as QuestionType,
          text: q.question,
          options: q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctIndex })),
        })),
      );
    }
    if (format === "programming" && data.config) {
      if (data.config.starterCode) setStarterCode(data.config.starterCode);
      if (data.config.expectedOutput) setExpectedOutput(data.config.expectedOutput);
      if (data.config.language) setProgLanguage(data.config.language);
    }
    if (format === "bundle" && data.subtasks) {
      setSubtasks(data.subtasks.map((s) => ({ type: s.type, title: s.title, description: s.description, config: s.config })));
    }
    setAiToast(true);
    setTimeout(() => setAiToast(false), 4000);
  }

  async function save(status: "draft" | "published") {
    if (!title.trim()) { setError("Введите название"); return; }
    if (format === "programming" && !description.trim()) { setError("Введите условие задачи"); return; }
    if (format === "bundle" && (subtasks.length < 1 || subtasks.length > 10)) { setError(d.teacher.bundleMinHint); return; }
    if (format === "bundle" && subtasks.some((s) => !s.title.trim())) { setError(d.teacher.bundleSubtaskTitle); return; }
    // БОЛЬШОЕ ОБНОВЛЕНИЕ §9.1 — ссылка необязательна: пустая строка → на
    // просмотре у ученика подставится DEFAULT_EXTERNAL_URLS, как на уроках
    // (см. TeacherLessonDetailView.tsx's `externalReady` — тот же паттерн).
    if (isExternalService(format) && externalUrl.trim()) {
      const v = validateServiceUrl(format, externalUrl);
      if (!v.valid) { setExternalUrlError(v.error); setError(v.error); return; }
      setExternalUrlError(null);
    }
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
        contentType: format,
        teacherId: resolvedTeacherId,
        lessonId: lessonId || null,
        status,
        testDurationSeconds: format === "test" ? testDuration * 60 : null,
        testAutoGrade: format === "test" ? autoGrade : true,
        programmingLanguage: format === "programming" ? progLanguage : null,
        starterCode: format === "programming" ? (starterCode || null) : null,
        expectedOutput: format === "programming" ? (expectedOutput || null) : null,
        externalUrl: isExternalService(format) ? (externalUrl.trim() || null) : null,
      });
      if (format === "test" && questions.length > 0) {
        await createTestQuestions(supabase, hw.id, questions.map((q, i) => ({
          questionText: q.text, questionType: q.type, orderIndex: i,
          options: q.type === "single_choice" ? q.options.map((o, oi) => ({ optionText: o.text, isCorrect: o.isCorrect, orderIndex: oi })) : undefined,
        })));
      }
      if (format === "file" && pickedFromKB) {
        // Linked, not copied — see linkedMaterialAttachmentPath/linkedBookAttachmentPath.
        const linkedPath = pickedFromKB.source === "book"
          ? linkedBookAttachmentPath(pickedFromKB.storagePath)
          : linkedMaterialAttachmentPath(pickedFromKB.storagePath);
        await setHomeworkAttachment(supabase, hw.id, {
          path: linkedPath, sizeByte: pickedFromKB.sizeBytes ?? 0, fileName: pickedFromKB.title,
        });
      } else if (format === "file" && attachFile) {
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
      if (format === "bundle" && subtasks.length > 0) {
        await createHomeworkSubtasks(supabase, hw.id, subtasks.map((s, i) => ({
          type: s.type, title: s.title.trim(), description: s.description.trim() || null, config: s.config, orderIndex: i,
        })));
      }
      if (hintFile) {
        const { path } = await uploadHomeworkHint(supabase, {
          teacherId: resolvedTeacherId, homeworkId: hw.id, fileName: hintFile.name, blob: hintFile,
        });
        await setHomeworkHint(supabase, hw.id, { path, fileName: hintFile.name, mimeType: hintFile.type });
      }
      router.push("/teacher/homework");
    } catch (e: unknown) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  const isExternal = isExternalService(format);
  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.4 — external-service options filtered by the
  // linked lesson's subject, when one is picked; standalone homework (no
  // lessonId) shows every service, same as before this change.
  const linkedLessonSubject = lessonsForGroup.find((l) => l.id === lessonId)?.subjectName ?? null;
  const allowedServiceOrder = EXTERNAL_SERVICE_ORDER.filter((key) => getServicesForSubject(linkedLessonSubject).includes(key));
  const TYPE_TABS: Array<{ key: Format; label: string; Icon: typeof FileText }> = [
    { key: "file", label: d.homework.typeFile, Icon: FileText },
    { key: "test", label: d.homework.typeTest, Icon: ClipboardList },
    { key: "programming", label: d.homework.typeProgramming, Icon: Code },
    { key: "bundle", label: d.homework.typeBundle, Icon: Layers },
    ...allowedServiceOrder.map((key) => ({ key, label: SERVICE_CONFIG[key].name, Icon: Globe })),
  ];
  const SUBTASK_TYPE_TABS: Array<{ key: HomeworkSubtaskType; label: string }> = [
    { key: "file", label: d.homework.typeFile },
    { key: "test", label: d.homework.typeTest },
    { key: "code", label: d.homework.typeProgrammingShort },
    ...allowedServiceOrder.map((key) => ({ key, label: SERVICE_CONFIG[key].name })),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-[22px] font-bold text-brand-ink">
          {d.teacher.newHomeworkTitle}
        </h1>
        {!isExternal && (
          <button
            type="button"
            onClick={() => setAiGenerateOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-50"
          >
            <EduOSAiIcon className="h-5 w-5" />
            {d.ai.generateHomework.button}
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
                const dateStr = new Date(l.starts_at).toLocaleDateString("ru-RU", {
                  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Tashkent",
                });
                const topic = l.title ?? l.topic;
                const label = topic
                  ? `${dateStr} · ${topic}`
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

        {/* Подсказка (§8.1) — независима от типа ДЗ, всегда доступна */}
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-brand-ink-muted">
            {d.teacher.hwHintLabel} <span className="text-slate-400 font-normal">(опционально)</span>
          </span>
          <input
            ref={hintRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={handleHintFileChange}
            className="hidden"
            id="hw-hint"
          />
          {hintFile ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-brand-blue/40 bg-blue-50/60 px-4 py-3">
              <Paperclip size={15} className="shrink-0 text-brand-blue" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-brand-blue">{hintFile.name}</p>
                <p className="text-[11px] text-slate-500">{(hintFile.size / (1024 * 1024)).toFixed(1)} МБ</p>
              </div>
              <button
                type="button"
                onClick={() => { setHintFile(null); if (hintRef.current) hintRef.current.value = ""; }}
                className="shrink-0 text-slate-400 hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label
              htmlFor="hw-hint"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleHintFileDrop}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-slate-200 p-6 text-center transition-all hover:border-brand-blue/40 hover:bg-blue-50/20"
            >
              <Paperclip size={20} className="text-slate-400" />
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.hwHintBtn}</span>
              <span className="text-[11px] text-slate-400">{d.teacher.hwHintHint}</span>
            </label>
          )}
          {hintError && <p className="mt-1.5 text-[12px] text-red-500">{hintError}</p>}
        </div>

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
            {pickedFromKB ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-brand-blue/40 bg-blue-50/60 px-4 py-3">
                <FolderSearch size={15} className="shrink-0 text-brand-blue" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-brand-blue">{pickedFromKB.title}</p>
                  <p className="text-[11px] text-slate-500">{d.knowledgeBase.title}</p>
                </div>
                <button type="button" onClick={() => setPickedFromKB(null)} className="shrink-0 text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ) : attachFile ? (
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
              <div className="flex flex-col gap-2">
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
                <button
                  type="button"
                  onClick={() => setShowKBPicker(true)}
                  className="flex items-center justify-center gap-2 rounded-[14px] border border-slate-200 py-2.5 text-[13px] font-medium text-brand-ink-muted transition-all hover:border-brand-blue/40 hover:bg-blue-50/20"
                >
                  <FolderSearch size={15} /> {d.knowledgeBase.browse}
                </button>
              </div>
            )}
          </div>
        )}

        <KnowledgeBaseFilePicker
          open={showKBPicker}
          onClose={() => setShowKBPicker(false)}
          onSelect={(items) => { const first = items[0]; if (first) { setPickedFromKB(first); setAttachFile(null); } }}
          groupIds={groupId ? [groupId] : []}
          multiSelect={false}
        />

        {isExternal && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.lesson.external.projectLink} <span className="text-slate-400 font-normal">(опционально) — {SERVICE_CONFIG[format].description}</span>
            </span>
            <input
              value={externalUrl}
              onChange={(e) => { setExternalUrl(e.target.value); setExternalUrlError(null); }}
              onBlur={() => {
                if (!externalUrl.trim()) return;
                const v = validateServiceUrl(format, externalUrl);
                setExternalUrlError(v.valid ? null : v.error);
              }}
              placeholder={SERVICE_CONFIG[format].placeholder}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20"
            />
            {externalUrlError && (
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
                <AlertCircle size={13} /> {externalUrlError}
              </span>
            )}
            {!externalUrlError && !externalUrl.trim() && (
              <span className="text-[12px] text-slate-400">{d.lesson.external.leaveEmptyHint}</span>
            )}
          </label>
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
            <div className="flex flex-wrap gap-2">
              {CODE_LANGUAGES.map((l) => (
                <button key={l} type="button" onClick={() => setProgLanguage(l)}
                  className={cn("flex items-center gap-2 rounded-[10px] border px-4 py-2 text-[13px] font-semibold transition-colors",
                    progLanguage === l ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-brand-ink-muted hover:border-emerald-300")}>
                  <span className={cn("h-3.5 w-3.5 rounded-full border-2", progLanguage === l ? "border-emerald-500 bg-emerald-500" : "border-slate-300")} />
                  {CODE_LANGUAGE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
          {/* Starter code (editable highlighted editor) */}
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.starterLabel}</span>
            <span className="mb-1 text-[11px] text-slate-400">{d.homework.programming.starterHint}</span>
            <CodeEditor value={starterCode} onChange={setStarterCode} language={progLanguage} minHeight={150} />
          </div>
          {/* Expected output — meaningless for html (no stdout, the student
              gets a live preview instead), so hidden for that language. */}
          {!isHtmlLanguage(progLanguage) && (
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-brand-ink-muted">{d.homework.programming.expectedLabel}</span>
              <span className="mb-1 text-[11px] text-slate-400">{d.homework.programming.expectedHint}</span>
              <textarea rows={2} value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)}
                placeholder="Hello, World!" spellCheck={false}
                className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink resize-none focus:outline-none focus:border-brand-blue/50"
                style={{ fontFamily: "'JetBrains Mono','Fira Code',Monaco,monospace" }} />
            </label>
          )}
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

      {format === "bundle" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-brand-ink">{d.teacher.bundleSubtasksBlock}</h2>
            <span className="text-[12px] text-brand-ink-muted">{d.teacher.bundleMinHint}</span>
          </div>

          {subtasks.length === 0 && (
            <p className="rounded-[14px] border-2 border-dashed border-slate-200 py-6 text-center text-[13px] text-brand-ink-muted">
              {d.teacher.bundleEmptyHint}
            </p>
          )}

          {subtasks.map((s, si) => (
            <div key={si} className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-4 space-y-3"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div className="flex items-start gap-3">
                <GripVertical size={16} className="mt-2 shrink-0 text-slate-300" />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[12px] font-bold text-brand-blue">{si + 1}</span>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={s.type} onChange={(e) => updateSubtask(si, { type: e.target.value as HomeworkSubtaskType })}
                      className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[12px] text-brand-ink focus:outline-none">
                      {SUBTASK_TYPE_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <button onClick={() => removeSubtask(si)} title={d.teacher.bundleRemoveSubtask} className="ml-auto text-slate-400 hover:text-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <input value={s.title} onChange={(e) => updateSubtask(si, { title: e.target.value })}
                    placeholder={d.teacher.bundleSubtaskTitle}
                    className="w-full rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50" />
                  <textarea rows={2} value={s.description} onChange={(e) => updateSubtask(si, { description: e.target.value })}
                    placeholder={d.teacher.bundleSubtaskDesc}
                    className="w-full rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2 text-[13px] text-brand-ink focus:outline-none focus:border-brand-blue/50 resize-none" />
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => addSubtask("file")}
            className="w-full rounded-[14px] border-2 border-dashed border-slate-200 py-3 text-[13px] font-semibold text-brand-ink-muted transition-all hover:border-brand-blue/40 hover:text-brand-blue">
            <Puzzle size={14} className="mr-1.5 inline" />
            {d.teacher.bundleAddSubtask}
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
          {format === "test" ? d.homework.test.createTest : (saving && attachFile ? d.teacher.hwAttachProgress : saving ? d.common.loading : d.teacher.publish)}
        </button>
      </div>

      <HomeworkAiGenerateModal
        isOpen={aiGenerateOpen}
        onClose={() => setAiGenerateOpen(false)}
        type={(isExternal ? "file" : format) as "file" | "test" | "programming" | "bundle"}
        groupLabel={groups.find((g) => g.id === groupId)?.name ?? ""}
        onApply={handleAiGenerateApply}
      />

      {aiToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[14px] bg-slate-800 px-4 py-3 text-[13px] font-medium text-white shadow-xl">
          <Check className="h-4 w-4 text-green-400" />
          {d.ai.generateHomework.appliedToast}
        </div>
      )}
    </div>
  );
}
