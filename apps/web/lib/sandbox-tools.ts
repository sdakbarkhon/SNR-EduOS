// Sandbox tools for the student "Песочница" — free experimentation, no grades,
// no saving. Each open is a clean start (ephemeral iframe / Monaco session).
//
// Adding a new tool later = append one entry here (+ its i18n in sandbox.tools).

import {
  CircuitBoard, Code2, Terminal, Ruler, FlaskConical, LineChart, Puzzle,
  Shuffle, Palette, PenTool, Brain, Database, Keyboard, Blocks,
  FileText, Table, Presentation, type LucideIcon,
} from "lucide-react";

export type SandboxToolId =
  | "wokwi" | "codesandbox" | "code"
  | "geogebra" | "phet" | "desmos" | "blockly_games" | "visualgo"
  | "p5js" | "excalidraw" | "learningapps" | "sqlonline" | "typerun"
  | "scratch" | "polotno"
  | "google_docs" | "google_sheets" | "google_slides";

export type SandboxTool = {
  id: SandboxToolId;
  /**
   * "iframe" → embed the editor; "code" → in-app Monaco runner;
   * "editor"  → редактор собран в наш бандл и рисуется прямо на странице
   *             (Polotno, проба 16.08.2026) — рамки и чужого адреса нет.
   */
  kind: "iframe" | "code" | "editor";
  /** Fresh-editor URL for iframe tools. */
  embedUrl?: string;
  Icon: LucideIcon;
  gradient: string;        // tailwind gradient classes for the card icon tile
};

/**
 * Пробная карточка Polotno — ВЫКЛЮЧЕНА на живом сайте.
 *
 * ПОЧЕМУ. Их лицензия требует подписку с первого дня работы: «Production use
 * requires a valid Polotno subscription at any time … including a tool that
 * only your own employees use». Школьная песочница — это работа, а не оценка
 * продукта, и 60 дней «на попробовать» её не покрывают. Пока вопрос оплаты не
 * решён, ученикам карточку показывать нельзя.
 *
 * КОД НЕ УДАЛЁН: экран, сохранение работ и наши шаблоны остаются на месте —
 * если заказчик решит платить, включение стоит одну переменную.
 *
 * КАК ВКЛЮЧИТЬ ЛОКАЛЬНО: в apps/web/.env.local дописать строку
 *     NEXT_PUBLIC_ENABLE_POLOTNO=1
 * и перезапустить `pnpm dev`. На проде переменной нет — карточки нет.
 */
const POLOTNO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_POLOTNO === "1";

const POLOTNO_TOOL: SandboxTool = {
  id: "polotno",
  kind: "editor",
  Icon: Palette,
  gradient: "from-fuchsia-500 to-rose-500",
};

export const SANDBOX_TOOLS: SandboxTool[] = [
  {
    id: "wokwi",
    kind: "iframe",
    embedUrl: "https://wokwi.com/projects/new/arduino-uno",
    Icon: CircuitBoard,
    gradient: "from-sky-400 to-blue-500",
  },
  {
    id: "codesandbox",
    kind: "iframe",
    embedUrl: "https://codesandbox.io/s/new",
    Icon: Code2,
    gradient: "from-slate-600 to-slate-800",
  },
  {
    id: "geogebra",
    kind: "iframe",
    embedUrl: "https://www.geogebra.org/classic",
    Icon: Ruler,
    gradient: "from-green-500 to-emerald-600",
  },
  {
    id: "phet",
    kind: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html",
    Icon: FlaskConical,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    id: "desmos",
    kind: "iframe",
    embedUrl: "https://www.desmos.com/calculator",
    Icon: LineChart,
    gradient: "from-teal-500 to-cyan-600",
  },
  {
    id: "blockly_games",
    kind: "iframe",
    embedUrl: "https://blockly.games/",
    Icon: Puzzle,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "visualgo",
    kind: "iframe",
    embedUrl: "https://visualgo.net/en",
    Icon: Shuffle,
    gradient: "from-purple-500 to-violet-600",
  },
  {
    id: "p5js",
    kind: "iframe",
    embedUrl: "https://editor.p5js.org/",
    Icon: Palette,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "excalidraw",
    kind: "iframe",
    embedUrl: "https://excalidraw.com/",
    Icon: PenTool,
    gradient: "from-slate-500 to-slate-700",
  },
  {
    id: "learningapps",
    kind: "iframe",
    embedUrl: "https://learningapps.org/",
    Icon: Brain,
    gradient: "from-lime-500 to-green-600",
  },
  {
    id: "sqlonline",
    kind: "iframe",
    embedUrl: "https://sqlime.org/",
    Icon: Database,
    gradient: "from-cyan-600 to-blue-700",
  },
  {
    id: "code",
    kind: "code",
    Icon: Terminal,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    // Пачка 6.1 — тренажёр печати. MonkeyType (изначальный выбор) отдаёт
    // X-Frame-Options: DENY — не встраивается физически. Заменён на
    // typerun.top (проверено curl -I — блокирующих заголовков нет).
    id: "typerun",
    kind: "iframe",
    embedUrl: "https://typerun.top/#rus_basic",
    Icon: Keyboard,
    gradient: "from-red-500 to-rose-600",
  },
  {
    // 08.08.2026 — Scratch на своём хостинге (подробности в
    // lib/external-services.ts). В ПЕСОЧНИЦЕ доступен ВСЕМ классам;
    // ограничение «только 1-5» относится лишь к типу этапа урока.
    id: "scratch",
    kind: "iframe",
    embedUrl: "https://snr-scratch.vercel.app",
    Icon: Blocks,
    gradient: "from-amber-400 to-orange-500",
  },
  {
    // 10.08.2026 — Google Документы. В песочнице ТРИ карточки, а тип этапа
    // урока один: здесь вид файла выбирается до открытия.
    //
    // ВЕДУТ НА ОБЩИЕ ФАЙЛЫ ШКОЛЫ, а не на создание нового. Адреса вида
    // docs.google.com/document/create требуют входа в аккаунт Google: все три
    // отвечают 302 на accounts.google.com (проверено), и в рамке ученик
    // увидел бы форму входа вместо редактора. Файлы ниже открыты «всем по
    // ссылке на редактирование» и правятся анонимно.
    //
    // Следствие, которое надо знать: файл ОДИН на всех — это песочница этапа
    // показа. Свой файл каждому появится вместе с раздачей прав, которая
    // вынесена в отдельную задачу.
    id: "google_docs",
    kind: "iframe",
    embedUrl: "https://docs.google.com/document/d/1oh1KTjQX7Yv_-dn-KwgHuX72X8t88FDPPs3BBPvM1uU/edit?rm=embedded",
    Icon: FileText,
    gradient: "from-blue-500 to-sky-600",
  },
  {
    id: "google_sheets",
    kind: "iframe",
    embedUrl: "https://docs.google.com/spreadsheets/d/1gK_LwoiYV7ivSpE71l5IJmLEPTwiToOH9efhiykzYog/edit?rm=embedded",
    Icon: Table,
    gradient: "from-emerald-500 to-green-600",
  },
  {
    id: "google_slides",
    kind: "iframe",
    embedUrl: "https://docs.google.com/presentation/d/1bTOZtVPs9IMjvMmEo9vrHB3ix9hgQamShl3i4VgQUQA/edit?rm=embedded",
    Icon: Presentation,
    gradient: "from-amber-500 to-yellow-600",
  },
];

/** Итоговый список: пробная карточка появляется только при включённом флаге. */
export const SANDBOX_TOOLS_VISIBLE: SandboxTool[] = POLOTNO_ENABLED
  ? [...SANDBOX_TOOLS, POLOTNO_TOOL]
  : SANDBOX_TOOLS;

/** Инструмент по id. Единственный источник иконки и градиента: списки
 *  вроде «внешних проектов» на /projects обязаны брать оформление отсюда,
 *  а не заводить свою табличку — расхождение уже случалось (у wokwi было
 *  два разных значка, у geogebra — тоже). */
export function sandboxToolById(id: SandboxToolId): SandboxTool | null {
  return SANDBOX_TOOLS.find((tool) => tool.id === id) ?? null;
}
