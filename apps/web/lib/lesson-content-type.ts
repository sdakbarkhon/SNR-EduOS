// 11.08.2026 — подпись и значок типа содержимого этапа. Единственный источник.
//
// До этого было три места:
//   • teacher/lessons/[id]/TeacherLessonDetailView.tsx — полная таблица на 19
//     типов (её и вынесли сюда);
//   • (app)/lessons/[id]/PreLessonView.tsx — switch, отставший на три типа:
//     scratch, typerun и google_docs проваливались в default и показывали
//     ученику ПУСТУЮ подпись и книжку вместо значка;
//   • (app)/lessons/[id]/LessonWorkspaceView.tsx — тернарник, знавший ровно
//     один тип («Презентация»), для остальных печатавший системное имя вроде
//     "google_docs".
//
// Подписи — Record<LessonContentType, …> без default: новый тип в союзе ломает
// сборку здесь, а не тихо превращается в пустую строку у ученика.
// Значки берём из SANDBOX_TOOLS: все типы, кроме четырёх «не-инструментов»
// (презентация, два вида тестов и код с пропусками), совпадают по имени с id
// инструмента песочницы, и второй набор картинок для них не нужен.

import { ClipboardCheck, Trophy, Presentation, Puzzle, type LucideIcon } from "lucide-react";
import type { LessonContentType, getDictionary } from "@snr/core";
import { sandboxToolById, type SandboxToolId } from "@/lib/sandbox-tools";

type LessonDict = ReturnType<typeof getDictionary>["lesson"];

/** Человеческая подпись типа этапа. Для null — пустая строка (у этапа просто
 *  нет типа: обычные «объяснение»/«итог» без содержимого). */
export function lessonContentTypeLabel(ct: LessonContentType | null, dl: LessonDict): string {
  if (!ct) return "";
  const map: Record<LessonContentType, string> = {
    presentation: dl.stageContentPresentation,
    code: dl.stageContentCode,
    wokwi: dl.stageContentWokwi,
    codesandbox: dl.stageContentCodesandbox,
    quiz_qia: dl.stageContentQuizQia,
    quiz_kahoot: dl.stageContentQuizKahoot,
    geogebra: dl.stageContentGeogebra,
    phet: dl.stageContentPhet,
    desmos: dl.stageContentDesmos,
    blockly_games: dl.stageContentBlocklyGames,
    visualgo: dl.stageContentVisualgo,
    p5js: dl.stageContentP5js,
    excalidraw: dl.stageContentExcalidraw,
    learningapps: dl.stageContentLearningapps,
    sqlonline: dl.stageContentSqlonline,
    typerun: dl.stageContentTyperun,
    scratch: dl.stageContentScratch,
    google_docs: dl.stageContentGoogleDocs,
    code_completion: dl.stageContentCodeCompletion,
  };
  return map[ct] ?? ct;
}

/** Значки типов, которых нет в песочнице. Остальные приходят из SANDBOX_TOOLS. */
const NON_TOOL_ICONS: Partial<Record<LessonContentType, LucideIcon>> = {
  presentation: Presentation,
  quiz_qia: ClipboardCheck,
  quiz_kahoot: Trophy,
  code_completion: Puzzle,
};

export function lessonContentTypeIcon(ct: LessonContentType | null, fallback: LucideIcon): LucideIcon {
  if (!ct) return fallback;
  const own = NON_TOOL_ICONS[ct];
  if (own) return own;
  return sandboxToolById(ct as SandboxToolId)?.Icon ?? fallback;
}
