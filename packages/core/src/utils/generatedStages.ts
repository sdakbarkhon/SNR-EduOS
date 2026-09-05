/**
 * Вставка сгенерированных этапов в урок. Заход Q2, 03.09.2026.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Маршрут `/api/ai/generate-stages` этапы НЕ вставляет
 * — он отдаёт JSON. Вставлял их клиент, функцией `addToLesson` внутри окна
 * `AiGenerateStagesModal`: пересчёт длительностей под урок, вставка по одному,
 * вопросы квиза, книги библиотеки. Пока наполнение было только поштучным, это
 * работало. Разборщику очереди нужна ровно та же работа, и переписать её у
 * себя значило бы завести вторую копию, которая через месяц разойдётся с
 * первой: одна кладёт вопросы квиза, другая забыла.
 *
 * Теперь правило одно и живёт здесь. Окно зовёт отсюда, разборщик — тоже.
 *
 * ПОЧЕМУ В ЯДРЕ, А НЕ В apps/web. Всё, что делает функция, — это вызовы
 * запросов ядра: addLessonStage, replaceQuizQuestions,
 * deleteLessonStage. Тащить их наружу
 * ради модуля в приложении незачем, а разборщик живёт на сервере и клиента
 * не имеет.
 */

import type { Db } from "../supabase/factory";
import type {
  LessonContentType,
  LessonSlide,
  LessonStageType,
  QuizQuestionInput,
  StageDifficulty,
} from "../types";
import {
  addLessonStage,
  deleteLessonStage,
  replaceQuizQuestions,
} from "../queries";

/** Этап, каким его отдаёт `/api/ai/generate-stages`. */
export type GeneratedStage = {
  stage_type: "theory" | "task";
  content_type: string;
  title: string;
  description?: string;
  teacher_notes?: string;
  starter_code?: string;
  programming_language?: string;
  slides?: LessonSlide[];
  quiz?: { questions: Array<{ text: string; options: string[]; correct_index: number }> };
  difficulty: StageDifficulty;
  duration_min: number;
};

/** Типы этапов, живущих на внешнем сервисе: им нужен адрес и ссылка. */
const EXTERNAL = [
  "wokwi", "codesandbox",
  "geogebra", "phet", "desmos", "blockly_games", "visualgo", "p5js",
  "excalidraw", "learningapps", "sqlonline",
];

/**
 * Раскладывает длительности этапов так, чтобы их сумма равнялась длительности
 * урока. Модель предлагает свои минуты, и они почти никогда не совпадают с
 * уроком; остаток докладывается последнему этапу, чтобы сумма сошлась точно.
 */
function fitDurations(stages: GeneratedStage[], lessonMinutes: number): GeneratedStage[] {
  const out = stages.map((s) => ({ ...s }));
  const total = out.reduce((sum, x) => sum + x.duration_min, 0);
  if (total <= 0 || total === lessonMinutes) return out;
  for (const s of out) {
    s.duration_min = Math.max(1, Math.round((s.duration_min * lessonMinutes) / total));
  }
  const newTotal = out.reduce((sum, x) => sum + x.duration_min, 0);
  const last = out[out.length - 1];
  if (last && newTotal !== lessonMinutes) {
    last.duration_min = Math.max(1, last.duration_min + (lessonMinutes - newTotal));
  }
  return out;
}

/**
 * Стирает этапы СЕРЕДИНЫ урока. «Старт» и «Итог» не трогаются: их кладёт
 * триггер fn_create_default_stages каждому уроку, они не содержимое.
 *
 * Возвращает, сколько стёрлось. Число нужно и разборщику (в отчёт), и окну
 * (оно обещает его человеку до нажатия).
 */
export async function removeMiddleStages(db: Db, lessonId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from("lesson_stages")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("stage_role", "middle");
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  // Через deleteLessonStage, а не пачкой: у неё внутри стоит защита
  // «start и summary не трогать», и обходить её здесь незачем.
  for (const id of ids) await deleteLessonStage(db, id);
  return ids.length;
}

/*
 * ═══ МАШИНА БОЛЬШЕ НЕ ПРИЦЕПЛЯЕТ КНИГИ. 06.09.2026 ════════════════════════
 *
 * Здесь стояла attachBooksFromKnowledgeBase — она цепляла к уроку до ТРЁХ книг
 * библиотеки того же предмета сразу после наполнения этапов.
 *
 * ЭТО ВТОРОЕ МЕСТО. Первое сняли 03.09.2026 (коммит 6c564568) — там карточка
 * заводилась в материалах группы на каждый этап со слайдами. Не помогло:
 * материал продолжал появляться, потому что цепляла ещё и эта функция, и
 * замер это подтвердил — шесть книг прицеплено после того коммита, две из них
 * пятого сентября.
 *
 * ПОЧЕМУ УБРАНО, А НЕ СУЖЕНО. Учитель не просил эти книги. Он просил наполнить
 * урок этапами; всё, что появляется сверх просьбы, он потом разбирает руками —
 * и разбирал: 254 материала уроков в базе, и ВСЕ до одного прицеплены этой
 * функцией.
 *
 * РУЧНОЕ ПРИКРЕПЛЕНИЕ НЕ ТРОНУТО. linkLessonMaterialFromKnowledgeBase жива и
 * зовётся из выбора материала учителем — он по-прежнему может добавить к уроку
 * что угодно, включая книгу библиотеки.
 */

export type ApplyStagesResult = {
  /** Сколько этапов вставлено. */
  inserted: number;
  /** Сколько этапов середины стёрто перед вставкой (перезаполнение). */
  removed: number;
  /* Поля booksAttached здесь больше нет: машина книг не цепляет (06.09.2026). */
};

/**
 * Положить сгенерированные этапы в урок.
 *
 * ПОРЯДОК ВАЖЕН и повторяет тот, что был в окне:
 *   1. при перезаполнении — стереть середину;
 *   2. пересчитать длительности под урок;
 *   3. вставить этапы по одному, вопросы квиза — сразу за своим этапом.
 *
 * Четвёртым шагом сюда цеплялись книги библиотеки — убрано 06.09.2026, см.
 * пояснение выше.
 */
export async function applyGeneratedStages(
  db: Db,
  input: {
    lessonId: string;
    teacherId: string;
    /** Длительность урока — под неё раскладываются минуты этапов. */
    lessonMinutes: number;
    /**
     * Название предмета. ВНУТРИ БОЛЬШЕ НЕ ЧИТАЕТСЯ: по нему подбирались книги
     * библиотеки, и вместе с ними ушла единственная причина его знать.
     *
     * Довод оставлен намеренно и с пометкой. Убрать его — значит поправить
     * вызывающих, а их два, и оба передают его осмысленно; когда наполнению
     * снова понадобится предмет (подпись этапа, подбор картинки), он окажется
     * на месте, а не вернётся третьим способом.
     */
    subjectName: string;
    /**
     * Школа урока. ОБЯЗАТЕЛЬНА ДЛЯ СЛУЖЕБНОГО КЛЮЧА, и вот почему.
     *
     * У четырёх таблиц на этом пути — lesson_stages, quiz_questions,
     * lesson_materials, course_materials — колонка school_id объявлена
     * NOT NULL с умолчанием current_school_id(). Под клиентом учителя оно
     * работает. Под служебным ключом auth.uid() пуст, значит пусто и
     * умолчание, и вставка падает с кодом 23502.
     *
     * Три из четырёх вызовов обёрнуты в .catch(), поэтому падали бы МОЛЧА:
     * урок вышел бы без вопросов квиза и без книг, и никто бы не узнал.
     * Найдено замером 03.09.2026, доказано пробой с откатом.
     *
     * Окно учителя может не передавать: у него сессия есть, умолчание в силе.
     */
    schoolId?: string;
    stages: GeneratedStage[];
    /** Стереть этапы середины перед вставкой. Перезаполнение (решение
     *  заказчика 02.09.2026): «старт» и «итог» не трогаются. */
    replaceExisting?: boolean;
    /** Отчёт о ходе: вставлено из скольких. Окну нужен для счётчика «3 из 7». */
    onProgress?: (saved: number, total: number) => void;
  },
): Promise<ApplyStagesResult> {
  const removed = input.replaceExisting ? await removeMiddleStages(db, input.lessonId) : 0;

  const toAdd = fitDurations(input.stages, input.lessonMinutes);
  let inserted = 0;
  input.onProgress?.(0, toAdd.length);

  for (const s of toAdd) {
    const config: Record<string, unknown> = {};
    if (s.content_type === "quiz_qia" || s.content_type === "quiz_kahoot") {
      config.time_limit_minutes = null;
      config.points_per_question = 1;
    } else if (EXTERNAL.includes(s.content_type)) {
      config.url = "";
      config.requires_link = true;
      config.requires_screenshot = false;
    }

    const newStage = await addLessonStage(db, input.lessonId, {
      stageType: s.stage_type as LessonStageType,
      contentType: s.content_type as LessonContentType,
      title: s.title,
      description: s.description ?? null,
      teacherNotes: s.teacher_notes ?? null,
      slides: s.slides && s.slides.length > 0 ? s.slides : null,
      ...(s.content_type === "code"
        ? {
            starterCode: s.starter_code ?? "",
            programmingLanguage: s.programming_language ?? "python",
          }
        : {}),
      config,
      difficulty: s.difficulty,
      durationMin: s.duration_min,
      schoolId: input.schoolId,
    });

    if (s.content_type === "quiz_qia" && s.quiz?.questions.length) {
      const questions: QuizQuestionInput[] = s.quiz.questions.map((q) => ({
        question_text: q.text,
        options: q.options,
        correct_option_index: q.correct_index,
      }));
      // Вопросы — «как получится»: этап уже стоит, и падение на вопросах не
      // должно отменять его. Так было и в окне.
      await replaceQuizQuestions(db, newStage.id, questions, input.schoolId).catch(() => null);
    }

    inserted += 1;
    input.onProgress?.(inserted, toAdd.length);
  }

  return { inserted, removed };
}
