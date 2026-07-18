// Пачка 5.1 — извлечение индексируемого текста из lesson_stages для RAG.
//
// ВАЖНО (проверено live-запросом к БД, не только чтением миграций):
// stage_role принимает только 'start' / 'middle' / 'summary' — значений
// 'theory'/'quiz_qia'/'practice' у stage_role НЕ БЫВАЕТ. Реальный
// дискриминатор типа контента внутри 'middle' — content_type:
// 'presentation' (теория, slides[]), 'quiz_qia'/'quiz_kahoot' (квиз,
// текст в отдельной таблице quiz_questions), и разные 'task'-типы
// (code/learningapps/geogebra/wokwi/blockly_games — текст в
// description/teacher_notes, если есть). Тот же content_type уже
// используется как дискриминатор в apps/web/app/api/ai/chat/route.ts —
// здесь применён тот же приём для консистентности.

type SlideJson = { title?: string; content?: string };

export type ExtractableStage = {
  content_type: string | null;
  slides: SlideJson[] | null;
  description: string | null;
  teacher_notes: string | null;
};

export type QuizQuestionForExtraction = {
  question_text: string;
  options: string[];
};

// ~500 токенов ≈ 2000 символов (эвристика "1 токен ≈ 4 символа"). Режем
// по параграфам (пустая строка), при переполнении абзаца — по предложениям.
const MAX_CHUNK_CHARS = 2000;

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= MAX_CHUNK_CHARS) return [trimmed];

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  function pushCurrent() {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  }

  for (const para of paragraphs) {
    if (para.length > MAX_CHUNK_CHARS) {
      // Абзац сам по себе больше лимита — режем по предложениям.
      pushCurrent();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sentenceChunk = "";
      for (const sentence of sentences) {
        if ((sentenceChunk + " " + sentence).length > MAX_CHUNK_CHARS && sentenceChunk) {
          chunks.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
        }
      }
      if (sentenceChunk.trim()) chunks.push(sentenceChunk.trim());
      continue;
    }
    if ((current + "\n\n" + para).length > MAX_CHUNK_CHARS && current) {
      pushCurrent();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  pushCurrent();
  return chunks;
}

/** Достаёт из этапа сырой текст для индексации в зависимости от
 *  content_type. quizQuestions передаётся отдельно — при content_type
 *  quiz_qia/quiz_kahoot текст лежит в таблице quiz_questions, не в
 *  lesson_stages. Без correct_option_index — retrieval-контекст не
 *  должен палить правильные ответы (та же логика, что уже в
 *  /api/ai/chat/route.ts для lesson-чата). */
function extractRawText(stage: ExtractableStage, quizQuestions: QuizQuestionForExtraction[]): string {
  if (stage.content_type === "presentation") {
    const slides = stage.slides ?? [];
    return slides.map((s) => `${s.title ?? ""}\n${s.content ?? ""}`).join("\n\n").trim();
  }
  if (stage.content_type === "quiz_qia" || stage.content_type === "quiz_kahoot") {
    return quizQuestions
      .map((q, i) => `Вопрос ${i + 1}: ${q.question_text}\nВарианты: ${(q.options ?? []).join(", ")}`)
      .join("\n\n");
  }
  // Прочие task-типы (code/learningapps/geogebra/wokwi/blockly_games и
  // любые будущие) — берём что есть в description/teacher_notes. Для
  // многих из них (внешние embed-сервисы) собственного текста в БД
  // почти нет — extractChunks в этом случае просто вернёт [].
  return [stage.description, stage.teacher_notes].filter(Boolean).join("\n\n").trim();
}

export function extractChunks(
  stage: ExtractableStage,
  quizQuestions: QuizQuestionForExtraction[] = [],
): string[] {
  return chunkText(extractRawText(stage, quizQuestions));
}
