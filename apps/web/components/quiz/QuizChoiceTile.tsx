"use client";

// 05.08.2026 — SNR-фирменный вид для обычных тестов (K.4). Универсальная
// плитка варианта ответа, переиспользуется в TestPlayer.tsx (домашка-тест)
// (тест внутри задания). Kahoot/QiaQuiz — отдельные,
// уже игровые компоненты, эту плитку не используют и не тронуты.
import { cn } from "@/lib/cn";

export type QuizChoiceTileState = "idle" | "selected" | "correct" | "wrong" | "disabled";

// Палитра сознательно НЕ повторяет классику Kahoot (красный/синий/жёлтый/
// зелёный) — взята из уже используемых в проекте брендовых токенов
// (@snr/ui-tokens: brand.blue, primaryGradient, subjects.informatics/
// chemistry) — синий/фиолетовый/голубой спектр, узнаваемый как SNR, а не
// как копия чужого квиз-приложения.
export const QUIZ_TILE_PALETTE = ["#2D5BFF", "#7A4DFF", "#0EA5E9", "#9B5DE5"] as const;

export const OPTION_LETTERS = ["А", "Б", "В", "Г", "Д", "Е"] as const;

export function QuizChoiceTile({
  index,
  label,
  optionLetter,
  state,
  onClick,
}: {
  index: number;
  // 08.08.2026 — было string. Стало ReactNode, чтобы можно было передать уже
  // отрендеренную разметку (MarkdownInline): в вариантах ответа встречаются
  // и формулы, и инлайн-код, и без этого они показывались сырыми.
  label: React.ReactNode;
  optionLetter?: string;
  state: QuizChoiceTileState;
  onClick?: () => void;
}) {
  const bg = QUIZ_TILE_PALETTE[index % QUIZ_TILE_PALETTE.length];
  const isInteractive = (state === "idle" || state === "selected") && !!onClick;

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={cn(
        "relative flex min-h-[100px] items-center justify-center rounded-2xl p-5 text-center text-xl font-bold text-white shadow-md transition-transform duration-150 sm:text-2xl",
        isInteractive ? "cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95" : "cursor-default",
        state === "selected" && "scale-95 ring-4 ring-white/80",
        state === "correct" && "animate-tile-pop border-4 border-green-400",
        state === "wrong" && "animate-tile-shake border-4 border-red-400",
        state === "disabled" && "opacity-50",
      )}
      style={{ backgroundColor: bg }}
    >
      {optionLetter && (
        <span className="absolute left-3 top-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-sm font-bold">
          {optionLetter}
        </span>
      )}
      <span className="px-2 [&_code]:bg-white/25 [&_code]:text-white">{label}</span>
    </button>
  );
}

/** Адаптивная раскладка: 2 колонки от sm и выше, 1 колонка на мобиле — даёт
 *  2×2 для 4 вариантов, 2+1 для 3, оборачивание для 5+ (без спец-оптимизации,
 *  по спеке — редкий случай). */
export function QuizChoiceGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
