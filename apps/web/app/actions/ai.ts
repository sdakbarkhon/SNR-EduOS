"use server";

import { generateText } from "@/lib/ai/gemini-client";
import { AI_TASKS } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";
import { getMySchoolNow } from "@/lib/school-time-server";

// callAiChat УДАЛЁН 17.08.2026. Это был второй механизм помощника: серверное
// действие со своим промтом, своей историей в sessionStorage браузера и БЕЗ
// какого-либо контекста урока. Именно из-за него помощник, открытый плавающей
// кнопкой внутри урока, называл чужую тему — урок в него не передавался вовсе.
// Прятать за переключателем не стали: механизм один, /api/ai/chat, и у него
// два режима. Клиенты ходят туда через lib/ai/ask-assistant.ts.
//
// buildRagContext ПЕРЕЕХАЛА 22.08.2026 в lib/ai/rag-context.ts. Здесь она
// осталась сиротой после удаления callAiChat: не экспортирована, ни одного
// вызова — то есть поиск по материалам не исполнялся с 17.08 ни разу, при
// живой очереди и посчитанных векторах. Теперь её зовёт сам маршрут
// /api/ai/chat. Держать ретривал в файле с "use server" было и вредно: любой
// экспорт отсюда становится серверным действием с точкой входа по сети, а
// ретривалу она не нужна.

export async function getStudyTip(): Promise<{ text: string } | { error: string }> {
  // Z.3, заход 2 — дата в подсказке от времени школы. Дневной лимит ИИ этим
  // НЕ затрагивается: он считается на стороне базы функцией
  // get_ai_usage_today() по `now() AT TIME ZONE 'Asia/Tashkent'`, то есть по
  // настоящим часам Postgres, и смена источника времени в приложении на
  // счётчики не влияет (проверено чтением определения функции).
  const supabase = await createClient();
  const today = (await getMySchoolNow(supabase)).toISOString().slice(0, 10);
  const prompt = `Ты — школьный коуч. Дай один практичный совет по учёбе, концентрации или продуктивности — 1-2 предложения, конкретно и по делу. Только совет, без вводных фраз. Дата: ${today}.\n\nДай совет по учёбе на сегодня.`;
  const { text, error } = await generateText(prompt, { usage: { task: AI_TASKS.studyTip } });
  if (error) return { error };
  return { text };
}

export async function getGradesAdvice(
  gradesSummary: string,
): Promise<{ text: string } | { error: string }> {
  const prompt = `Ты — добрый школьный наставник. На основе оценок ученика дай персональный совет: что улучшить, на что обратить внимание, что делать дальше. Ответ — 2-3 предложения, поддерживающий тон, конкретно. Только совет, без вводных.\n\n${gradesSummary}`;
  const { text, error } = await generateText(prompt, { usage: { task: AI_TASKS.gradesAdvice } });
  if (error) return { error };
  return { text };
}
