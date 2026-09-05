"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  createTeacherHomework,
  createTestQuestions,
  createHomeworkSubtasks,
  uploadHomeworkAttachment,
  setHomeworkAttachment,
  setHomeworkAttachmentVideo,
  setHomeworkAttachmentVideoFile,
  uploadHomeworkTestsFile,
  uploadHomeworkHint,
  setHomeworkHint,
  getTeacherLessonsForGroup,
  linkedMaterialAttachmentPath,
  linkedBookAttachmentPath,
} from "@snr/core";
import type { Locale, HomeworkSubtaskType, ContentType, CodeLanguage, SubjectWithGroup, CodeCompletionGap } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { FileText, ClipboardList, Trash2, Paperclip, X, ChevronLeft, Check, Code, GripVertical, Puzzle, Globe, AlertCircle, FolderSearch, Link2, Blocks } from "lucide-react";
import { CodeCompletionBuilder, codeCompletionValid } from "@/components/teacher/CodeCompletionBuilder";
import { KnowledgeBaseFilePicker, type PickedKnowledgeBaseFile } from "@/components/KnowledgeBaseFilePicker";
import { parseVideoUrl } from "@/lib/video-url";
import { uploadVideoFile } from "@/lib/video-storage";
import { HomeworkAiGenerateModal, type GeneratedHomework } from "./HomeworkAiGenerateModal";
import { isHomeworkAiType } from "@/lib/ai/homework-ai-types";
import { EduOSAssistantIcon } from "@/components/EduOSAssistantIcon";
import { CodeEditor } from "@/components/CodeEditor";
import { cn } from "@/lib/cn";
import { SERVICE_CONFIG, isExternalService, validateServiceUrl } from "@/lib/external-services";
import { servicesForSubject, type SubjectServices } from "@/lib/subject-services";
import { CODE_LANGUAGES, CODE_LANGUAGE_LABELS, isHtmlLanguage } from "@/lib/code-languages";

type Format = ContentType;
type QuestionType = "single_choice" | "open";

interface Option { text: string; isCorrect: boolean }
interface Question { type: QuestionType; text: string; options: Option[] }
interface Subtask { type: HomeworkSubtaskType; title: string; description: string; config: Record<string, unknown> }

interface Props {
  groups: Array<{ id: string; name: string; subject: string }>;
  subjects: SubjectWithGroup[];
  /** Наборы сервисов предметов школы (миграция 258). Пусто — все сервисы. */
  subjectServicesRaw?: Record<string, string[]>;
  teacherId: string;
}

/**
 * ПОТОЛОК ДЛИТЕЛЬНОСТИ ТЕСТА — ТРИ ЧАСА.
 *
 * Столько же стояло в поле раньше (max={180}), и это разумно: школьный урок
 * идёт сорок пять минут, самая длинная контрольная — две пары. Тест на сутки
 * заводить незачем, а опечатка в три знака («300» вместо «30») иначе прошла бы
 * молча.
 */
const TEST_DURATION_MAX_MIN = 180;

export function CreateHomeworkForm({ groups, subjects, teacherId, subjectServicesRaw }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const supabase = createClient();

  const [format, setFormat] = useState<Format>("file");
  /**
   * ДЛИТЕЛЬНОСТЬ ТЕСТА — СТРОКОЙ, А НЕ ЧИСЛОМ. 04.09.2026.
   *
   * Было число и `Math.max(1, parseInt(v) || 1)` на каждое нажатие. Стереть
   * поле было нельзя: пустая строка даёт NaN, `|| 1` возвращал единицу, и
   * единица тут же вставала обратно. Учитель набирал 30 поверх неё и получал
   * 130 — ровно то, на что пожаловался заказчик.
   *
   * ПУСТОЕ ПОЛЕ МЕЖДУ ДВУМЯ НАЖАТИЯМИ — НОРМАЛЬНОЕ СОСТОЯНИЕ. Поэтому здесь
   * строка: она умеет быть пустой. Запрет стоит при сохранении, а не при
   * вводе — см. проверку в handleSubmit.
   */
  const [testDuration, setTestDuration] = useState("10"); // минуты, строкой
  const [autoGrade, setAutoGrade] = useState(true);
  const [progLanguage, setProgLanguage] = useState<CodeLanguage>("python");
  const [starterCode, setStarterCode] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalUrlError, setExternalUrlError] = useState<string | null>(null);
  // content_type='code_completion' (Drag & Drop код) — раньше учитель не мог
  // создать такое ДЗ вообще, тип существовал только для сгенерированных
  // скриптом. Редактор общий с формой этапа урока (CodeCompletionBuilder).
  const [ccTemplate, setCcTemplate] = useState("");
  const [ccGaps, setCcGaps] = useState<CodeCompletionGap[]>([]);
  const [ccLang, setCcLang] = useState<CodeLanguage>("python");
  const [testsFile, setTestsFile] = useState<File | null>(null);
  const testsRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessonId, setLessonId] = useState<string>("");
  const [lessonsForGroup, setLessonsForGroup] = useState<
    Array<{ id: string; starts_at: string; topic: string | null; title: string | null; lesson_no: number | null; subjectId: string | null; subjectName: string | null }>
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
  // Заход 2 (миграция 149) — третий взаимоисключающий вариант вложения:
  // своя ссылка на YouTube/RuTube вместо файла. Валидность — производное
  // значение (parseVideoUrl), не отдельный кусок state, тот же паттерн,
  // что в TeacherLessonDetailView.tsx (uploadVideoUrl/parsedVideoUrl).
  const [attachVideoUrl, setAttachVideoUrl] = useState("");
  const parsedVideoUrl = attachVideoUrl.trim() ? parseVideoUrl(attachVideoUrl.trim()) : null;
  const videoUrlInvalid = attachVideoUrl.trim().length > 0 && !parsedVideoUrl;
  const fileRef = useRef<HTMLInputElement>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiToast, setAiToast] = useState(false);
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false);
  /** Составленное помощником, которое ждёт ответа «заменить или дополнить». */
  const [aiОжидает, setAiОжидает] = useState<GeneratedHomework | null>(null);

  useEffect(() => {
    if (!groupId) return;
    setLessonId("");
    setSubjectId("");
    getTeacherLessonsForGroup(supabase, groupId)
      .then(setLessonsForGroup)
      .catch((e) => {
        console.error("[CreateHomeworkForm] getTeacherLessonsForGroup failed:", e?.message ?? e);
        setLessonsForGroup([]);
      });
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A previously-picked lesson may belong to a different subject than the
  // newly picked one — drop it rather than silently keep a mismatched link.
  useEffect(() => {
    setLessonId("");
  }, [subjectId]);
  const MAX_FILE_BYTES = 50 * 1024 * 1024;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) { setError(d.teacher.hwErrFileTooBig.replace("{size}", "50")); e.target.value = ""; return; }
    setError(null);
    setAttachFile(f);
    setAttachVideoUrl("");
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) { setError(d.teacher.hwErrFileTooBig.replace("{size}", "50")); return; }
    setError(null);
    setAttachFile(f);
    setAttachVideoUrl("");
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

  /**
   * ЧТО У УЧИТЕЛЯ УЖЕ ЗАПОЛНЕНО. Список для вопроса «заменить или дополнить»:
   * называем поля своими именами, а не «данные будут потеряны».
   */
  /**
   * СНИМОК ПОЛЕЙ, КОТОРЫЙ НЕ УСТАРЕВАЕТ.
   *
   * Ответ помощника приходит через десять–тридцать секунд, и обработчик,
   * пойманный замыканием в момент нажатия «Составить», видел бы форму такой,
   * какой она была ТОГДА. Учитель за это время успевает и закрыть окно, и
   * набрать название руками — и проверка «занято ли поле» отвечала бы «пусто»
   * на непустую форму, то есть затирала бы написанное молча. Ровно то, что
   * эта правка и убирает.
   *
   * Ref обновляется после каждой отрисовки, поэтому любой поздний вызов
   * читает настоящее состояние, а не снимок годичной давности.
   */
  const поля = useRef({
    title, description, format, questions, starterCode, expectedOutput, ccTemplate, ccGaps, subtasks,
  });
  useEffect(() => {
    поля.current = {
      title, description, format, questions, starterCode, expectedOutput, ccTemplate, ccGaps, subtasks,
    };
  });

  /**
   * ЧТО У УЧИТЕЛЯ УЖЕ ЗАПОЛНЕНО. Список для вопроса «заменить или дополнить»:
   * называем поля своими именами, а не «данные будут потеряны».
   */
  function занятыеПоля(): string[] {
    const п = поля.current;
    const занято: string[] = [];
    if (п.title.trim()) занято.push(d.teacher.formName.toLowerCase());
    if (п.description.trim()) занято.push(d.teacher.formDesc.toLowerCase());
    if (п.format === "test" && п.questions.length > 0) занято.push(d.teacher.hwAiFieldQuestions);
    if (п.format === "programming" && (п.starterCode.trim() || п.expectedOutput.trim())) занято.push(d.teacher.hwAiFieldCode);
    if (п.format === "code_completion" && (п.ccTemplate.trim() || п.ccGaps.length > 0)) занято.push(d.teacher.hwAiFieldTemplate);
    if (п.format === "bundle" && п.subtasks.length > 0) занято.push(d.teacher.hwAiFieldSubtasks);
    return занято;
  }

  /**
   * ПОМОЩНИК БОЛЬШЕ НЕ ЗАТИРАЕТ НАПИСАННОЕ БЕЗ СПРОСА. 06.09.2026.
   *
   * Было: первым же делом setTitle/setDescription — молча, поверх всего, что
   * учитель успел набрать, и отменить это было нечем. Помощник вызывается
   * кнопкой в шапке, то есть чаще всего именно тогда, когда часть формы уже
   * заполнена руками.
   *
   * Стало: поля заняты — спрашиваем. «Заменить» работает ровно как раньше,
   * «Дополнить» НЕ ТЕРЯЕТ НИЧЕГО: название остаётся своё, описание дописывается
   * снизу, вопросы добавляются к имеющимся, а заполненный код и шаблон с
   * пропусками не трогаются вовсе — дописать код нельзя, и делать вид, что
   * можно, было бы враньём. Пустые поля заполняются в обоих случаях.
   */
  function handleAiGenerateApply(data: GeneratedHomework) {
    if (занятыеПоля().length === 0) {
      применитьОтПомощника(data, "заменить");
      return;
    }
    setAiОжидает(data);
  }

  function применитьОтПомощника(data: GeneratedHomework, режим: "заменить" | "дополнить") {
    const заменяем = режим === "заменить";
    // Настоящие значения на момент ПРИМЕНЕНИЯ, а не на момент нажатия.
    const п = поля.current;

    /*
     * «ЗАМЕНИТЬ» — ЭТО ЗАМЕНИТЬ, А НЕ СТЕРЕТЬ.
     *
     * Описание помощник возвращает не всегда: у теста и у кода с пропусками
     * проверка ответа его не требует (нужны вопросы либо шаблон), и пустая
     * строка — законный ответ. Присвоение без оглядки затирало бы условие,
     * написанное учителем, пустотой — а в сохранении для этих двух типов
     * проверки описания нет вовсе: задание уходило бы к ученику без единого
     * слова о том, что делать. Кнопка обещает содержимое помощника, а не
     * удаление, поэтому пустое не кладём никогда.
     */
    if (data.title.trim() && (заменяем || !п.title.trim())) setTitle(data.title);
    if (data.description.trim()) {
      if (заменяем || !п.description.trim()) setDescription(data.description);
      else setDescription((было) => `${было}

${data.description}`);
    }

    if (п.format === "test" && data.config?.questions) {
      const пришли = data.config.questions.map((q) => ({
        type: "single_choice" as QuestionType,
        text: q.question,
        options: q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctIndex })),
      }));
      setQuestions((было) => (заменяем ? пришли : [...было, ...пришли]));
    }
    if (п.format === "programming" && data.config) {
      /*
       * КОД, ЕГО ЯЗЫК И ЕГО ВЫВОД — ОДНА ТРОЙКА, А НЕ ТРИ ПОЛЯ.
       *
       * Развести их по отдельным проверкам нельзя: у учителя свой стартовый
       * код на Java и пустое поле «Ожидаемый вывод», которое он собирался
       * дописать. Отдельная проверка положила бы туда вывод питоновской
       * программы помощника — той самой, что в форму не попала. Ученик
       * увидел бы ожидаемый вывод, не имеющий отношения к условию, и
       * подгонял бы решение под чужой ответ.
       *
       * Поэтому одно условие на всю тройку: код учителя занят — от помощника
       * не берём НИЧЕГО из этой тройки.
       */
      const кодСвободен = заменяем || (!п.starterCode.trim() && !п.expectedOutput.trim());
      if (кодСвободен) {
        // ЦЕЛИКОМ, ВКЛЮЧАЯ ПУСТОЕ. Три отдельные проверки на непустоту рвали
        // ту самую тройку, ради которой стоит одно условие: у задачи без
        // печатаемого вывода помощник возвращает пустой expectedOutput, и
        // рядом с его новым кодом оставался ожидаемый вывод от ПРЕЖНЕЙ задачи
        // учителя. Ученик подгонял бы решение под чужой ответ.
        setStarterCode(data.config.starterCode ?? "");
        setExpectedOutput(data.config.expectedOutput ?? "");
        if (data.config.language) setProgLanguage(data.config.language);
      }
    }
    // Код с пропусками: шаблон и пропуски приходят в тех же именах, в каких
    // лежат в задании, — раскладывать по-другому не нужно.
    if (п.format === "code_completion" && data.config) {
      const шаблонСвободен = заменяем || (!п.ccTemplate.trim() && п.ccGaps.length === 0);
      if (шаблонСвободен) {
        if (data.config.code_template) setCcTemplate(data.config.code_template);
        if (Array.isArray(data.config.gaps)) setCcGaps(data.config.gaps);
        // ЯЗЫК КЛАДЁМ В ccLang, А НЕ В progLanguage. Здесь стояло второе — и
        // это было мимо: у «кода с пропусками» свой язык (ccLang), его же
        // показывает редактор и его же сохраняет форма. Шаблон приезжал на
        // JavaScript, а задание уходило в базу питоновским: ученик получал
        // чужую подсветку. Заодно молча менялся язык «Программирования».
        if (data.config.language) setCcLang(data.config.language);
      }
    }
    if (п.format === "bundle" && data.subtasks) {
      const пришли = data.subtasks.map((s) => ({ type: s.type, title: s.title, description: s.description, config: s.config }));
      setSubtasks((было) => (заменяем ? пришли : [...было, ...пришли]));
    }

    setAiОжидает(null);
    setAiToast(true);
    setTimeout(() => setAiToast(false), 4000);
  }

  async function save() {
    // ПРОВЕРКИ ИДУТ СВЕРХУ ВНИЗ, КАК ПОЛЯ ЛЕЖАТ НА ЭКРАНЕ. 03.09.2026.
    //
    // Раньше порядок был другой: название → поля типа → класс → предмет →
    // дедлайн. Учитель, заполнивший форму наполовину, получал ошибки в
    // порядке, которого на экране нет: поправил название — и его бросало
    // вниз, к полям выбранного типа, хотя пустыми оставались класс, предмет
    // и дедлайн прямо под курсором. Теперь сперва все четыре обязательных
    // поля общей части, и только потом — то, что зависит от типа.
    if (!title.trim()) { setError(d.teacher.hwErrTitle); return; }
    if (!groupId) { setError(d.teacher.hwErrGroup); return; }
    if (!subjectId) { setError(d.lesson.createSelectSubject); return; }
    if (!deadline) { setError(d.teacher.hwErrDeadline); return; }

    // Длительность теста: пустое и ноль не принимаем ЗДЕСЬ, а не при вводе.
    if (format === "test") {
      const минут = Number(testDuration);
      if (!testDuration.trim() || !Number.isFinite(минут) || минут <= 0) {
        setError(d.teacher.hwErrTestDuration);
        return;
      }
      if (минут > TEST_DURATION_MAX_MIN) {
        setError(d.teacher.hwErrTestDurationMax.replace("{max}", String(TEST_DURATION_MAX_MIN)));
        return;
      }
    }

    if (format === "programming" && !description.trim()) { setError(d.teacher.hwErrTask); return; }
    if (format === "bundle" && (subtasks.length < 1 || subtasks.length > 10)) { setError(d.teacher.bundleMinHint); return; }
    if (format === "bundle" && subtasks.some((s) => !s.title.trim())) { setError(d.teacher.bundleSubtaskTitle); return; }
    if (format === "file" && videoUrlInvalid) { setError(d.lesson.materialInvalidVideoUrl); return; }
    if (format === "code_completion" && !codeCompletionValid(ccTemplate, ccGaps)) {
      setError(d.teacher.hwErrGaps);
      return;
    }
    // БОЛЬШОЕ ОБНОВЛЕНИЕ §9.1 — ссылка необязательна: пустая строка → на
    // просмотре у ученика подставится DEFAULT_EXTERNAL_URLS, как на уроках
    // (см. TeacherLessonDetailView.tsx's `externalReady` — тот же паттерн).
    if (isExternalService(format) && externalUrl.trim()) {
      const v = validateServiceUrl(format, externalUrl);
      if (!v.valid) { setExternalUrlError(v.error); setError(v.error); return; }
      setExternalUrlError(null);
    }
    // teacherId may be "" if getMyTeacher failed at page load — fetch from auth as fallback
    let resolvedTeacherId = teacherId;
    if (!resolvedTeacherId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError(d.teacher.hwErrNoSession); return; }
      const { data: t } = await supabase.from("teachers").select("id").eq("user_id", user.id).single();
      if (!t) { setError(d.teacher.hwErrNoTeacher); return; }
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
        subjectId: subjectId || null,
        testDurationSeconds: format === "test" ? Number(testDuration) * 60 : null,
        testAutoGrade: format === "test" ? autoGrade : true,
        programmingLanguage: format === "programming" ? progLanguage : null,
        starterCode: format === "programming" ? (starterCode || null) : null,
        expectedOutput: format === "programming" ? (expectedOutput || null) : null,
        externalUrl: isExternalService(format) ? (externalUrl.trim() || null) : null,
        codeCompletionData: format === "code_completion"
          ? {
              code_template: ccTemplate,
              gaps: ccGaps.map((g) => ({ ...g, options: g.options.filter((o) => o.trim()) })),
              language: ccLang,
              task_description: description.trim() || undefined,
            }
          : null,
      });
      if (format === "test" && questions.length > 0) {
        await createTestQuestions(supabase, hw.id, questions.map((q, i) => ({
          questionText: q.text, questionType: q.type, orderIndex: i,
          options: q.type === "single_choice" ? q.options.map((o, oi) => ({ optionText: o.text, isCorrect: o.isCorrect, orderIndex: oi })) : undefined,
        })));
      }
      if (format === "file" && pickedFromKB) {
        if (pickedFromKB.contentType === "video_youtube" || pickedFromKB.contentType === "video_rutube") {
          // Заход 2 (миграция 149) — видео-ссылка из Материалов кафедры:
          // storagePath пуст для видео-элементов (см. PickedKnowledgeBaseFile),
          // линковать как файл (linkedMaterialAttachmentPath) было бы тихой
          // порчей данных — video-путь пишет отдельные attachment_external_url/
          // attachment_source_url колонки, а не attachment_storage_path.
          if (!pickedFromKB.externalUrl || !pickedFromKB.sourceUrl) {
            throw new Error("Видео-ссылка библиотеки без external_url/source_url — повреждённая запись");
          }
          await setHomeworkAttachmentVideo(supabase, hw.id, {
            contentType: pickedFromKB.contentType,
            externalUrl: pickedFromKB.externalUrl,
            sourceUrl: pickedFromKB.sourceUrl,
          });
        } else {
          // Linked, not copied — see linkedMaterialAttachmentPath/linkedBookAttachmentPath.
          const linkedPath = pickedFromKB.source === "book"
            ? linkedBookAttachmentPath(pickedFromKB.storagePath)
            : linkedMaterialAttachmentPath(pickedFromKB.storagePath);
          await setHomeworkAttachment(supabase, hw.id, {
            path: linkedPath, sizeByte: pickedFromKB.sizeBytes ?? 0, fileName: pickedFromKB.title,
          });
        }
      } else if (format === "file" && attachFile && attachFile.name.toLowerCase().endsWith(".mp4")) {
        // K.1, 05.08.2026 — .mp4 идёт отдельным путём: bucket lesson-videos
        // (не homework-files) + attachment_content_type='video_mp4'.
        const uploaded = await uploadVideoFile(supabase, resolvedTeacherId, attachFile);
        await setHomeworkAttachmentVideoFile(supabase, hw.id, {
          storagePath: uploaded.storagePath, sizeByte: uploaded.sizeBytes, fileName: attachFile.name,
        });
      } else if (format === "file" && attachFile) {
        const { path, sizeByte } = await uploadHomeworkAttachment(supabase, {
          teacherId: resolvedTeacherId,
          homeworkId: hw.id,
          fileName: attachFile.name,
          blob: attachFile,
        });
        await setHomeworkAttachment(supabase, hw.id, { path, sizeByte, fileName: attachFile.name });
      } else if (format === "file" && parsedVideoUrl) {
        // Заход 2 — своя ссылка, вставленная вручную (не из библиотеки).
        await setHomeworkAttachmentVideo(supabase, hw.id, {
          contentType: parsedVideoUrl.platform === "youtube" ? "video_youtube" : "video_rutube",
          externalUrl: parsedVideoUrl.embedUrl,
          sourceUrl: attachVideoUrl.trim(),
        });
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
  /**
   * ТИП ДЛЯ ПОМОЩНИКА — НАСТОЯЩЕЙ ПРОВЕРКОЙ, А НЕ ПРИВЕДЕНИЕМ. 06.09.2026.
   *
   * Было: `format as "file" | "test" | "programming" | "bundle"` в месте
   * вызова. Приведение — обещание компилятору, а не проверка: «код с
   * пропусками» в союз не входил и проходил мимо него молча. Работало это
   * случайно, и никто бы не узнал, если бы ручка его не поддерживала.
   *
   * Теперь союз один на всех (lib/ai/homework-ai-types.ts), а сужение делает
   * isHomeworkAiType — она и правда смотрит на значение. Тип, которого
   * помощник не умеет, честно даёт null, и кнопка гаснет.
   */
  const типДляПомощника = isHomeworkAiType(format) ? format : null;
  /** Помощник не открывается, пока не сказано, для кого задание: без класса и
   *  предмета уровень уходит в модель как «—», а подстройка под группу не
   *  работает вовсе. */
  const subjectsForGroup = subjects.filter((s) => s.group_id === groupId);
  /**
   * ПРЕДМЕТ, КОТОРЫЙ ВОТ-ВОТ БУДЕТ ВЫБРАН, СЧИТАЕТСЯ ВЫБРАННЫМ.
   *
   * У класса ровно один предмет — его подставляет эффект ниже. Но эффект
   * пассивный: между сменой класса и его срабатыванием проходит целый
   * отрисованный кадр, в котором предмета «нет». Всё, что от предмета
   * зависит, в этом кадре решает неправду — и решения успевают закрепиться.
   *
   * Так и вышло: учитель выбрал Wokwi для «Робототехники» 7А и переключил
   * класс на 7Б с той же «Робототехникой». Сброс типа читал кадр без
   * предмета и возвращал к «Файлу», хотя предмет тот же и Wokwi у него
   * разрешён. Выбор отбирали на ровном месте.
   *
   * Поэтому предмет считается прямо в отрисовке, а не догоняется эффектом:
   * гонки нет вовсе, и промежуточного кадра с пустой полкой тоже.
   */
  const эффективныйПредмет = subjectId || (subjectsForGroup.length === 1 ? subjectsForGroup[0]!.id : "");
  const помощникГотов = !!groupId && !!эффективныйПредмет && типДляПомощника !== null;
  const lessonsForSubject = lessonsForGroup.filter((l) => !эффективныйПредмет || l.subjectId === эффективныйПредмет);
  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.4 — external-service options filtered by the
  // selected subject; falls back to the linked lesson's subject for the rare
  // case a lesson is picked without an explicit subject (shouldn't happen
  // now that subject is required, kept for standalone/legacy safety).
  const selectedSubjectName = subjects.find((s) => s.id === эффективныйПредмет)?.name
    ?? lessonsForGroup.find((l) => l.id === lessonId)?.subjectName
    ?? null;
  // Карта собирается здесь: через границу сервер → клиент Map не переживает.
  const subjectServices: SubjectServices = useMemo(
    () => new Map(Object.entries(subjectServicesRaw ?? {})),
    [subjectServicesRaw],
  );

  // Набор — из справочника школы (миграция 258). Ключ ищем по строке
  // справочника, а если экран её не знает — по названию предмета.
  const allowedServiceOrder = servicesForSubject(
    subjectServices,
    subjects.find((s) => s.id === эффективныйПредмет)?.catalog_id ?? selectedSubjectName,
  );

  /**
   * ПРЕДМЕТ ВЫБИРАЕТСЯ САМ, КОГДА ОН У КЛАССА ОДИН. 03.09.2026.
   *
   * Пока предмет не выбран, заперто поле «К какому уроку» и НЕ сужен список
   * типов задания — то есть одна незаполненная строка держала две помехи
   * сразу. Если выбора нет вовсе, требовать его от человека незачем.
   *
   * Ровно один — и только он: при двух и более предметах выбор остаётся за
   * учителем, подставлять первый попавшийся было бы враньём.
   */
  useEffect(() => {
    if (subjectsForGroup.length === 1 && !subjectId) setSubjectId(subjectsForGroup[0]!.id);
  }, [subjectsForGroup, subjectId]);

  /**
   * ВЫБРАННЫЙ СЕРВИС НЕ МОЖЕТ ОСТАТЬСЯ ВЫБРАННЫМ, ИСЧЕЗНУВ С ЭКРАНА.
   *
   * Список внешних сервисов сужается по предмету. Учитель мог нажать
   * «Wokwi», потом выбрать «Математику» — кнопка пропадала, а `format`
   * оставался `wokwi`: форма продолжала работать в режиме, которого на
   * экране больше нет, и ни одна кнопка не была подсвечена.
   *
   * Это хуже непонятности — это неправда. Возвращаем к «Файлу»: он есть
   * всегда и ничего не теряет, кроме самого выбора типа.
   */
  useEffect(() => {
    // Без предмета полка сервисов свёрнута, и подсветить выбранный нечем:
    // ни одна кнопка типа не горит, а поле ссылки внизу висит. Раньше этого
    // состояния не было — полка показывала все четырнадцать. Возвращаем к
    // «Файлу» и здесь тоже: allowedServiceOrder без предмета отдаёт ВСЕ
    // сервисы, поэтому проверка ниже сама по себе такой случай не ловит.
    if (isExternalService(format) && !selectedSubjectName) { setFormat("file"); return; }
    if (isExternalService(format) && !allowedServiceOrder.includes(format)) setFormat("file");
  }, [allowedServiceOrder, format, selectedSubjectName]);

  /**
   * ОКНО ПОМОЩНИКА ЗАКРЫВАЕТСЯ, КОГДА ОТКРЫВАТЬ ЕГО СТАЛО НЕЛЬЗЯ.
   *
   * Смена класса сбрасывает предмет (эффект выше по файлу) — то есть окно,
   * открытое на одном классе, теряет право на существование прямо во время
   * работы. Без этой строки оно бы просто исчезло с экрана, а признак
   * «открыто» остался бы взведённым: выбрал предмет — и окно выскакивает
   * само, пустое. Гасим признак вместе с правом.
   */
  useEffect(() => {
    if (!помощникГотов) setAiGenerateOpen(false);
  }, [помощникГотов]);

  /**
   * ТИПЫ ЗАДАНИЯ, СГРУППИРОВАННЫЕ ПО ПРИЗНАКУ «ЧТО ВЕРНЁТСЯ НА ПРОВЕРКУ».
   * 03.09.2026.
   *
   * Раньше все девятнадцать кнопок вываливались одним flex-wrap в четыре
   * ряда — без порядка и без единого слова о том, чем они друг от друга
   * отличаются. Заказчик открыл экран и сказал: «даже я не понимаю, что
   * там нужно сделать».
   *
   * ПОЧЕМУ ДЕЛИМ ИМЕННО ТАК. Деление по предметам уже сделано машиной —
   * список сервисов сужается по выбранному предмету сам (getServicesFor-
   * Subject). Повторять его заголовками значит объяснять то, что и так
   * отфильтровано. А вот ЧТО ВЕРНЁТСЯ УЧИТЕЛЮ — нигде не написано, и это
   * ровно тот вопрос, ответа на который у человека нет:
   *
   *   тест и код с пропусками   считаются на сервере, оценка без учителя;
   *   файл и программирование   работа приходит обратно, оценивает человек;
   *   сервисы предмета          работа живёт на чужом сайте, обратно
   *                             не приходит ничего.
   *
   * (Во второй полке был ещё «набор заданий» — снят с экрана 06.09.2026,
   * см. комментарий над самой полкой ниже. Третья полка теперь показывает
   * не все четырнадцать, а набор выбранного предмета.)
   *
   * НИЧЕГО НЕ ПРЯЧЕМ. Заказчик прямо просил не убирать типы за выпадающий
   * список — все они остаются на экране, только разложены по трём полкам.
   *
   * Механизмы типов не тронуты: это тот же массив, что и был, разрезанный
   * на три и снабжённый заголовками.
   */
  type ТипКнопки = { key: Format; label: string; Icon: typeof FileText };
  const ГРУППЫ_ТИПОВ: Array<{
    title: string; hint: string; count: string | null;
    /** Текст вместо кнопок, когда полка сознательно пуста. */
    empty?: string | null;
    items: ТипКнопки[];
  }> = [
    {
      title: d.teacher.hwGroupAuto,
      hint: d.teacher.hwGroupAutoHint,
      count: null,
      items: [
        { key: "test", label: d.homework.typeTest, Icon: ClipboardList },
        { key: "code_completion", label: d.homework.typeCodeCompletion, Icon: Blocks },
      ],
    },
    {
      title: d.teacher.hwGroupManual,
      hint: d.teacher.hwGroupManualHint,
      count: null,
      /*
       * «НАБОР ЗАДАНИЙ» УБРАН С ЭКРАНА. 06.09.2026. Решение заказчика.
       *
       * Замер: за всё время ноль заданий типа bundle и ноль подзадач в базе.
       * При этом тип стоил дороже всех остальных: свой промт, свой редактор
       * подзадач, семнадцать кнопок выбора типов в помощнике — и единственный
       * из пяти, который уходит к модели БЕЗ строгой схемы (форма config
       * зависит от соседнего поля "type", а responseSchema так не умеет).
       * То есть самый ненадёжный тип на экране был и самым невостребованным.
       *
       * ИЗ ДАННЫХ НЕ УБРАН. content_type='bundle' остаётся в типах и в базе,
       * витрина (карточка задания, экран ученика, экран учителя, решатель
       * подзадач) не тронута: появись такое задание — оно откроется.
       *
       * КОД СОЗДАНИЯ ОСТАВЛЕН НАМЕРЕННО и разбросан по всему файлу: ветка в
       * применитьОтПомощника и проверки при сохранении — ВЫШЕ этой строки,
       * SUBTASK_TYPE_TABS и редактор подзадач — ниже. Всё это стало
       * недостижимо, но цело: вернуть тип на экран значит вернуть строку сюда
       * и иконку Layers в импорт lucide-react наверху файла (её убрали, чтобы
       * не держать мёртвый импорт), а не переписывать форму.
       */
      items: [
        { key: "file", label: d.homework.typeFile, Icon: FileText },
        { key: "programming", label: d.homework.typeProgramming, Icon: Code },
      ],
    },
    {
      title: d.teacher.hwGroupExternal,
      hint: d.teacher.hwGroupExternalHint,
      // Число рядом с заголовком снимает неожиданность: список внешних
      // сервисов перестраивается, когда учитель выбирает предмет, и без
      // подписи это выглядит как сбой экрана.
      count: selectedSubjectName
        ? d.teacher.hwGroupExternalCount
            .replace("{n}", String(allowedServiceOrder.length))
            .replace("{subject}", selectedSubjectName)
        : null,
      /*
       * ПОЛКА МОЛЧИТ, ПОКА НЕ ВЫБРАН ПРЕДМЕТ. 06.09.2026.
       *
       * До выбора предмета здесь лежали ВСЕ четырнадцать сервисов — то есть
       * четырнадцать кнопок, из которых для будущего предмета годятся четыре
       * или восемь. Учитель нажимал «Wokwi», выбирал ниже «Математику», и
       * кнопка исчезала: тип молча падал обратно на «Файл» (см. useEffect
       * выше). Экран забирал выбор, которого сам же и предложил.
       *
       * Теперь пустая полка говорит словами, что нужно сделать. Ни один тип
       * не удалён: выбрали предмет — сервисы на месте.
       */
      empty: selectedSubjectName ? null : d.teacher.hwServicesNeedSubject,
      items: selectedSubjectName
        ? allowedServiceOrder.map((key) => ({ key, label: SERVICE_CONFIG[key].name, Icon: Globe }))
        : [],
    },
  ];
  const SUBTASK_TYPE_TABS: Array<{ key: HomeworkSubtaskType; label: string }> = [
    { key: "file", label: d.homework.typeFile },
    { key: "test", label: d.homework.typeTest },
    { key: "code", label: d.homework.typeProgrammingShort },
    ...allowedServiceOrder.map((key) => ({ key, label: SERVICE_CONFIG[key].name })),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </button>
        <h1 className="flex-1 text-[22px] font-bold text-brand-ink">
          {d.teacher.newHomeworkTitle}
        </h1>
        {!isExternal && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setAiGenerateOpen(true)}
              disabled={!помощникГотов}
              title={помощникГотов ? undefined : d.teacher.hwAiNeedsClassSubject}
              className="flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
            >
              <EduOSAssistantIcon className="h-5 w-5" />
              {d.ai.generateHomework.button}
            </button>
            {/* Причина словами, а не одной серой кнопкой: заказчик прямо
                называл «понятно, только когда попробуешь» как поломку. */}
            {!помощникГотов && (
              <span className="text-[11.5px] text-amber-700">{d.teacher.hwAiNeedsClassSubject}</span>
            )}
          </div>
        )}
      </div>

      {/*
        * КЛАСС И ПРЕДМЕТ — НАД ТИПАМИ. 06.09.2026.
        *
        * Порядок на экране был обратен зависимости. Кнопки типов стояли
        * первыми, а класс и предмет — ниже, в общей карточке полей. Между тем
        * набор типов ЗАВИСИТ от предмета: полка внешних сервисов сужается по
        * справочнику школы. Человек выбирал тип раньше, чем становилось
        * известно, какие типы вообще есть, — и выбранный сервис у него потом
        * отбирали.
        *
        * Теперь сначала «для кого», потом «что». Ни одно поле не потеряно:
        * оба переехали сюда из сетки ниже, вместе со своими подписями и
        * звёздочками; название и дедлайн остались там, где были.
        */}
      <section className="rounded-[20px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <h2 className="text-[13px] font-bold text-brand-ink">{d.teacher.hwClassAndSubject}</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.teacher.formGroup} <span className="text-red-500">*</span>
            </span>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.teacher.formSubject} <span className="text-red-500">*</span>
            </span>
            {subjectsForGroup.length === 0 ? (
              <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700">
                {d.lesson.createNoSubjects}
              </p>
            ) : (
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none">
                <option value="">{d.lesson.createSelectSubject}</option>
                {subjectsForGroup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </label>
        </div>
      </section>

      {/* ВЫБОР ТИПА — три полки с заголовками. Разбор в ГРУППЫ_ТИПОВ выше. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {ГРУППЫ_ТИПОВ.map((г) => (
          <section
            key={г.title}
            className="rounded-[20px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
          >
            <h2 className="text-[13px] font-bold text-brand-ink">
              {г.title}
              {г.count && (
                <span className="ml-1.5 font-medium text-brand-ink-muted">· {г.count}</span>
              )}
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{г.hint}</p>
            {г.empty && (
              <p className="mt-3 rounded-[12px] border border-dashed border-amber-200 bg-amber-50/60 px-3 py-2.5 text-[12px] leading-snug text-amber-800">
                {г.empty}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {г.items.map((t) => {
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
          </section>
        ))}
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        {/* Строка-легенда: раньше на экране не было сказано НИ СЛОВА о том,
            что обязательно. Обязательных ровно четыре — название, класс,
            предмет, дедлайн; всё остальное можно оставить пустым. */}
        <p className="text-[12px] text-slate-500">
          <span className="text-red-500">*</span> {d.teacher.hwRequiredLegend}
        </p>

        {/* ДВЕ КОЛОНКИ. Экран учителя не адаптируется под телефон (только
            768 и шире), а форма сидела в max-w-2xl — 672 px на холсте 1920,
            и справа пустовала тысяча. Поля общей части идут парами; блоки,
            зависящие от типа, ниже остаются во всю ширину: там редакторы
            кода и списки вопросов, которым узкая колонка вредна. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.teacher.formName} <span className="text-red-500">*</span>
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.teacher.formDeadline} <span className="text-red-500">*</span>
            </span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-brand-ink-muted">{d.teacher.formDesc}</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50 focus:ring-2 focus:ring-brand-blue/20 resize-none" />
        </label>

        {/* Lesson selector — filtered to the selected subject's lessons;
            disabled until a subject is chosen (a subject-less list would be
            the unfiltered "каша" this was built to fix). */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-brand-ink-muted">
            {d.lesson.linkLesson}
          </span>
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            disabled={!эффективныйПредмет}
            className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!эффективныйПредмет ? (
              <option value="">{d.lesson.selectSubjectFirst}</option>
            ) : (
              <>
                <option value="">{d.lesson.noLesson}</option>
                {lessonsForSubject.map((l) => {
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
              </>
            )}
          </select>
          {/* Зависимость сказана словами, а не одной бледной строкой внутри
              закрытого списка: заказчик прямо назвал её как пример того,
              что «видно только когда попробуешь». */}
          {!эффективныйПредмет && (
            <span className="text-[11.5px] text-amber-700">{d.teacher.hwLessonNeedsSubject}</span>
          )}
        </label>

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
                {pickedFromKB.contentType === "video_youtube" || pickedFromKB.contentType === "video_rutube" ? (
                  <Link2 size={15} className="shrink-0 text-brand-blue" />
                ) : (
                  <FolderSearch size={15} className="shrink-0 text-brand-blue" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-brand-blue">{pickedFromKB.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {pickedFromKB.contentType === "video_youtube" || pickedFromKB.contentType === "video_rutube"
                      ? d.lesson.materialVideoTag
                      : d.knowledgeBase.title}
                  </p>
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
            ) : parsedVideoUrl ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-brand-blue/40 bg-blue-50/60 px-4 py-3">
                <Link2 size={15} className="shrink-0 text-brand-blue" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-brand-blue">{attachVideoUrl.trim()}</p>
                  <p className="text-[11px] text-slate-500">{d.lesson.materialVideoTag}</p>
                </div>
                <button type="button" onClick={() => setAttachVideoUrl("")} className="shrink-0 text-slate-400 hover:text-red-500">
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
                {/* Заход 2 (миграция 149) — своя видео-ссылка вместо файла;
                    те же ключи и та же логика (parseVideoUrl), что и на
                    форме "Прикрепить материал" урока. */}
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-brand-ink-muted">{d.lesson.materialVideoUrlLabel}</span>
                  <input
                    type="text"
                    value={attachVideoUrl}
                    onChange={(e) => { setAttachVideoUrl(e.target.value); setAttachFile(null); setPickedFromKB(null); }}
                    placeholder="https://..."
                    className={cn(
                      "rounded-[10px] border bg-white/80 px-3 py-2.5 text-[13px] text-brand-ink focus:outline-none focus:ring-2",
                      videoUrlInvalid
                        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-200 focus:border-brand-blue/50 focus:ring-brand-blue/20",
                    )}
                  />
                  {videoUrlInvalid && <span className="text-[11px] text-red-500">{d.lesson.materialInvalidVideoUrl}</span>}
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
          onSelect={(items) => { const first = items[0]; if (first) { setPickedFromKB(first); setAttachFile(null); setAttachVideoUrl(""); } }}
          groupIds={groupId ? [groupId] : []}
          multiSelect={false}
          // Заход 2 (миграция 149) — задание теперь поддерживает video_*
          // вложения (attachment_content_type/attachment_external_url/
          // attachment_source_url на homework) — библиотечные видео-ссылки
          // больше не нужно скрывать (см. save() выше: pickedFromKB.contentType
          // video_* → setHomeworkAttachmentVideo, не линковка storagePath).
          allowVideoLinks
        />

        {isExternal && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">
              {d.lesson.external.projectLink} <span className="text-slate-400 font-normal">(опционально) — {SERVICE_CONFIG[format].description}</span>
            </span>
            {SERVICE_CONFIG[format].accessHint && (
              <span className="text-[11px] leading-snug text-amber-600">
                {SERVICE_CONFIG[format].accessHint}
              </span>
            )}
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
              <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder={String(TEST_DURATION_MAX_MIN)}
                value={testDuration}
                // Только цифры, и пустое поле разрешено: правит человек, а не
                // сторож. Тип text вместо number намеренно — number в браузере
                // отдаёт пустую строку и на «12e», и на «-», и отличить одно от
                // другого в onChange уже нельзя.
                onChange={(e) => setTestDuration(e.target.value.replace(/\D/g, ""))}
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
              onChange={(e) => { const f = e.target.files?.[0] ?? null; if (f && f.size > 10 * 1024 * 1024) { setError(d.teacher.hwErrFileTooBig.replace("{size}", "10")); if (testsRef.current) testsRef.current.value = ""; return; } setError(null); setTestsFile(f); }}
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

      {format === "code_completion" && (
        <div className="rounded-[20px] border border-white/80 bg-white/70 p-4 backdrop-blur-xl"
          style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <CodeCompletionBuilder
            codeTemplate={ccTemplate}
            onCodeTemplateChange={setCcTemplate}
            gaps={ccGaps}
            onGapsChange={setCcGaps}
            language={ccLang}
            onLanguageChange={setCcLang}
          />
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

      {/* ЧЕРНОВИКА БОЛЬШЕ НЕТ. 04.09.2026.
          Кнопка «Сохранить черновик» звала тот же save(), только с доводом
          status: "draft" — а колонки статуса у homework НЕТ ВОВСЕ, и довод
          молча выбрасывался при вставке. То есть «черновик» публиковался
          сразу, наравне с «Создать»: кнопка обещала то, чего никогда не
          делала. Заказчик решил, что черновики не нужны, — убираем и
          кнопку, и мёртвый довод. */}
      <div className="flex gap-3">
        <button onClick={() => save()} disabled={saving}
          className="rounded-[12px] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)", boxShadow: "0 4px 16px rgba(29,111,245,0.35)" }}>
          {format === "test" ? d.homework.test.createTest : (saving && attachFile ? d.teacher.hwAttachProgress : saving ? d.common.loading : d.teacher.publish)}
        </button>
      </div>

      {/* Окно живёт, только когда тип помощнику знаком и сказано, для кого
          задание: пустой уровень и отсутствие группы обесценивали генерацию. */}
      {типДляПомощника && помощникГотов && (
        <HomeworkAiGenerateModal
          isOpen={aiGenerateOpen}
          onClose={() => setAiGenerateOpen(false)}
          type={типДляПомощника}
          groupLabel={groups.find((g) => g.id === groupId)?.name ?? ""}
          groupId={groupId}
          subjectId={эффективныйПредмет}
          allowedServices={allowedServiceOrder}
          onApply={handleAiGenerateApply}
        />
      )}

      {/*
        * ЗАМЕНИТЬ ИЛИ ДОПОЛНИТЬ — вопрос вместо молчаливого затирания.
        *
        * ЧЕРЕЗ ПОРТАЛ, как и соседнее окно помощника. Прямым ребёнком формы
        * затемнение получало от `space-y-5` отступ сверху в 20 пикселей: у
        * `fixed inset-0` он входит в уравнение высоты, и вдоль верхнего края
        * оставалась незатемнённая полоса, сквозь которую клики проходили в
        * шапку под окном — попытка закрыть окно кликом по фону могла увести
        * со страницы и потерять всю заполненную форму.
        */}
      {aiОжидает && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAiОжидает(null); }}
        >
          <div className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl">
            <h3 className="text-[16px] font-bold text-brand-ink">{d.teacher.hwAiFilledTitle}</h3>
            <p className="mt-2 text-[13.5px] leading-snug text-brand-ink-muted">
              {d.teacher.hwAiFilledBody.replace("{fields}", занятыеПоля().join(", "))}
            </p>
            <p className="mt-2 text-[12px] leading-snug text-slate-500">{d.teacher.hwAiFilledHint}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiОжидает(null)}
                className="rounded-[12px] px-4 py-2.5 text-[14px] font-semibold text-brand-ink-muted hover:bg-slate-100"
              >
                {d.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => применитьОтПомощника(aiОжидает, "дополнить")}
                className="rounded-[12px] border border-slate-200 px-4 py-2.5 text-[14px] font-semibold text-brand-ink hover:bg-slate-50"
              >
                {d.teacher.hwAiAppend}
              </button>
              <button
                type="button"
                onClick={() => применитьОтПомощника(aiОжидает, "заменить")}
                className="rounded-[12px] bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-110"
              >
                {d.teacher.hwAiReplace}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {aiToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[14px] bg-slate-800 px-4 py-3 text-[13px] font-medium text-white shadow-xl">
          <Check className="h-4 w-4 text-green-400" />
          {d.ai.generateHomework.appliedToast}
        </div>
      )}
    </div>
  );
}
