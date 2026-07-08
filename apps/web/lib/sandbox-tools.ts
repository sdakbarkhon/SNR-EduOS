// Sandbox tools for the student "Песочница" — free experimentation, no grades,
// no saving. Each open is a clean start (ephemeral iframe / Monaco session).
//
// Adding a new tool later = append one entry here (+ its i18n in sandbox.tools).

export type SandboxToolId =
  | "wokwi" | "codesandbox" | "code"
  | "geogebra" | "phet" | "desmos" | "blockly_games" | "visualgo"
  | "p5js" | "excalidraw" | "learningapps" | "sqlonline";

export type SandboxTool = {
  id: SandboxToolId;
  /** "iframe" → embed the editor; "code" → in-app Monaco runner. */
  kind: "iframe" | "code";
  /** Fresh-editor URL for iframe tools. */
  embedUrl?: string;
  icon: string;            // emoji
  gradient: string;        // tailwind gradient classes for the card icon tile
};

export const SANDBOX_TOOLS: SandboxTool[] = [
  {
    id: "wokwi",
    kind: "iframe",
    embedUrl: "https://wokwi.com/projects/new/arduino-uno",
    icon: "⚡",
    gradient: "from-sky-400 to-blue-500",
  },
  {
    id: "codesandbox",
    kind: "iframe",
    embedUrl: "https://codesandbox.io/s/new",
    icon: "🌐",
    gradient: "from-slate-600 to-slate-800",
  },
  {
    id: "geogebra",
    kind: "iframe",
    embedUrl: "https://www.geogebra.org/classic",
    icon: "📐",
    gradient: "from-green-500 to-emerald-600",
  },
  {
    id: "phet",
    kind: "iframe",
    embedUrl: "https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html",
    icon: "🔬",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    id: "desmos",
    kind: "iframe",
    embedUrl: "https://www.desmos.com/calculator",
    icon: "📈",
    gradient: "from-teal-500 to-cyan-600",
  },
  {
    id: "blockly_games",
    kind: "iframe",
    embedUrl: "https://blockly.games/",
    icon: "🧩",
    gradient: "from-amber-400 to-orange-500",
  },
  {
    id: "visualgo",
    kind: "iframe",
    embedUrl: "https://visualgo.net/en",
    icon: "🔀",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    id: "p5js",
    kind: "iframe",
    embedUrl: "https://editor.p5js.org/",
    icon: "🎨",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    id: "excalidraw",
    kind: "iframe",
    embedUrl: "https://excalidraw.com/",
    icon: "🖊️",
    gradient: "from-slate-500 to-slate-700",
  },
  {
    id: "learningapps",
    kind: "iframe",
    embedUrl: "https://learningapps.org/",
    icon: "🧠",
    gradient: "from-lime-500 to-green-600",
  },
  {
    id: "sqlonline",
    kind: "iframe",
    embedUrl: "https://sqlime.org/",
    icon: "🗄️",
    gradient: "from-cyan-600 to-blue-700",
  },
  {
    id: "code",
    kind: "code",
    icon: "💻",
    gradient: "from-emerald-500 to-teal-600",
  },
];
