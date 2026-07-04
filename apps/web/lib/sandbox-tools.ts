// Sandbox tools for the student "Песочница" — free experimentation, no grades,
// no saving. Each open is a clean start (ephemeral iframe / Monaco session).
//
// Adding a new tool later = append one entry here (+ its i18n in sandbox.tools).

export type SandboxToolId = "turbowarp" | "wokwi" | "codesandbox" | "makecode" | "code";

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
    id: "turbowarp",
    kind: "iframe",
    // A bare "/editor" (no project id) renders TurboWarp's own "Invalid
    // Embed" page when framed — only a real project's /<id>/embed URL works
    // inside an iframe. Points at a known-good public starter project.
    embedUrl: "https://turbowarp.org/60917032/embed",
    icon: "🎨",
    gradient: "from-orange-400 to-amber-500",
  },
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
    id: "makecode",
    kind: "iframe",
    embedUrl: "https://arcade.makecode.com/",
    icon: "🎮",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "code",
    kind: "code",
    icon: "💻",
    gradient: "from-emerald-500 to-teal-600",
  },
];
