// Промт "Gemini migration" — модельная стратегия для всех AI-фич платформы.
// Flash по умолчанию (чат, короткие ответы) — Pro только там, где реально
// нужно качество (длинный контент, парсинг). См. resheniya_2.md для оценки
// экономии в долларах.

export const GEMINI_MODEL_FLASH = "gemini-2.5-flash";
export const GEMINI_MODEL_PRO = "gemini-2.5-pro";

export type AiModelTier = "flash" | "pro";

export function resolveModel(tier?: AiModelTier): string {
  return tier === "pro" ? GEMINI_MODEL_PRO : GEMINI_MODEL_FLASH;
}

// Ориентировочные цены (USD за 1M токенов, публичный прайс Gemini API) —
// используются только для оценки экономии в отчётах, не участвуют в рантайме.
export const PRICING_USD_PER_1M = {
  [GEMINI_MODEL_FLASH]: { input: 0.075, output: 0.3 },
  [GEMINI_MODEL_PRO]: { input: 1.25, output: 5.0 },
  // Для сравнения — то, что мигрируем ОТ:
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
} as const;
