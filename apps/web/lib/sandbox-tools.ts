// Sandbox tools for the student "Песочница" — free experimentation, no grades,
// no saving. Each open is a clean start (ephemeral iframe / Monaco session).
//
// Adding a new tool later = append one entry here (+ its i18n in sandbox.tools).

import {
  CircuitBoard, Code2, Terminal, Ruler, FlaskConical, LineChart, Puzzle,
  Shuffle, Palette, PenTool, Brain, Database, Grid3x3, Keyboard, type LucideIcon,
} from "lucide-react";

export type SandboxToolId =
  | "wokwi" | "codesandbox" | "code"
  | "geogebra" | "phet" | "desmos" | "blockly_games" | "visualgo"
  | "p5js" | "excalidraw" | "learningapps" | "sqlonline" | "h5p" | "typerun";

export type SandboxTool = {
  id: SandboxToolId;
  /** "iframe" → embed the editor; "code" → in-app Monaco runner. */
  kind: "iframe" | "code";
  /** Fresh-editor URL for iframe tools. */
  embedUrl?: string;
  Icon: LucideIcon;
  gradient: string;        // tailwind gradient classes for the card icon tile
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
    id: "h5p",
    kind: "iframe",
    embedUrl: "https://h5p.eduos.snruz.uz/library",
    Icon: Grid3x3,
    gradient: "from-fuchsia-500 to-purple-600",
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
];
