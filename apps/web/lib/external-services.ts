// Whitelist + URL validation for the external-service lesson stages.
// All twelve services (wokwi, codesandbox, geogebra, phet, desmos,
// blockly_games, visualgo, p5js, excalidraw, learningapps, sqlonline, h5p)
// support iframe embed.

import type { ExternalServiceType } from "@snr/core";

// Self-hosted H5P app (apps/h5p), deployed as its own Vercel project on this
// subdomain — see УЧ.9.
export const H5P_BASE_URL = "https://h5p.eduos.snruz.uz";

type ServiceMeta = {
  name: string;
  embedSupported: boolean;
  urlPattern: RegExp;
  extractEmbedUrl: (url: string) => string | null;
  placeholder: string;
  errorMsg: string;
  description?: string;
};

export const SERVICE_CONFIG: Record<ExternalServiceType, ServiceMeta> = {
  wokwi: {
    name: "Wokwi",
    embedSupported: true,
    // Test URL: https://wokwi.com/projects/322152588697239634
    urlPattern: /^https?:\/\/(www\.)?wokwi\.com\/projects\/(\d+)/,
    extractEmbedUrl: (url) => {
      const match = url.match(/projects\/(\d+)/);
      return match ? `https://wokwi.com/projects/${match[1]}?embed=1` : null;
    },
    placeholder: "https://wokwi.com/projects/322152588697239634",
    errorMsg: "Неверная ссылка. Ожидается ссылка на проект Wokwi (wokwi.com/projects/...)",
    description: "Симулятор электронных схем Arduino, ESP32, Raspberry Pi",
  },

  codesandbox: {
    name: "CodeSandbox",
    embedSupported: true,
    // Supports: codesandbox.io/p/sandbox/abc123 (new) and codesandbox.io/s/abc123 (legacy)
    // Test URL: https://codesandbox.io/p/sandbox/react-new
    urlPattern: /^https?:\/\/(www\.)?codesandbox\.io\/(p\/sandbox|s|embed)\/([a-zA-Z0-9-]+)/,
    extractEmbedUrl: (url) => {
      const match = url.match(/codesandbox\.io\/(?:p\/sandbox|s|embed)\/([a-zA-Z0-9-]+)/);
      return match ? `https://codesandbox.io/embed/${match[1]}?view=editor` : null;
    },
    placeholder: "https://codesandbox.io/p/sandbox/react-new",
    errorMsg: "Неверная ссылка. Ожидается ссылка на проект CodeSandbox (codesandbox.io/...)",
    description: "Создание веб-приложений в браузере (React, Vue и др.)",
  },

  geogebra: {
    name: "GeoGebra",
    embedSupported: true,
    urlPattern:
      /^https?:\/\/(www\.)?geogebra\.org\/(classic|m\/[\w-]+|material\/iframe\/id\/\d+|calculator|geometry|graphing|3d)/i,
    extractEmbedUrl: (url) => {
      const trimmed = url.trim();
      if (/material\/iframe\/id\/(\d+)/.test(trimmed)) return trimmed;
      const match = trimmed.match(/geogebra\.org\/m\/([\w-]+)/);
      if (match) return `https://www.geogebra.org/material/iframe/id/${match[1]}`;
      return trimmed;
    },
    placeholder: "https://www.geogebra.org/classic или https://www.geogebra.org/m/abc123",
    errorMsg:
      "Неверная ссылка. Ожидается ссылка на GeoGebra (geogebra.org/classic, /m/... или /material/iframe/id/...)",
    description: "Графики, геометрия, статистика — интерактивная математика",
  },

  phet: {
    name: "PhET Simulations",
    embedSupported: true,
    urlPattern:
      /^https?:\/\/phet\.colorado\.edu\/(en\/simulations\/[\w-]+|sims\/html\/[\w-]+\/latest\/[\w-]+_en\.html)/i,
    extractEmbedUrl: (url) => {
      const trimmed = url.trim();
      const match =
        trimmed.match(/en\/simulations\/([\w-]+)/) || trimmed.match(/sims\/html\/([\w-]+)/);
      return match ? `https://phet.colorado.edu/sims/html/${match[1]}/latest/${match[1]}_en.html` : null;
    },
    placeholder: "https://phet.colorado.edu/en/simulations/forces-and-motion-basics",
    errorMsg:
      "Неверная ссылка. Ожидается ссылка на симуляцию PhET (phet.colorado.edu/en/simulations/...)",
    description: "Симуляции по физике, химии и биологии",
  },

  desmos: {
    name: "Desmos",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?desmos\.com\/calculator(\/[\w]+)?/i,
    extractEmbedUrl: (url) => url.trim().replace(/[?#].*$/, ""),
    placeholder: "https://www.desmos.com/calculator",
    errorMsg: "Неверная ссылка. Ожидается ссылка на калькулятор Desmos (desmos.com/calculator/...)",
    description: "Графический калькулятор и алгебра",
  },

  blockly_games: {
    name: "Blockly Games",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?blockly\.games\/?[\w-]*/i,
    extractEmbedUrl: (url) => url.trim().replace(/[?#].*$/, ""),
    placeholder: "https://blockly.games/maze",
    errorMsg: "Неверная ссылка. Ожидается ссылка на Blockly Games (blockly.games/...)",
    description: "Визуальное программирование для младших классов",
  },

  visualgo: {
    name: "VisuAlgo",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?visualgo\.net\/\w{2}(\/[\w-]*)?/i,
    extractEmbedUrl: (url) => url.trim().replace(/[?#].*$/, ""),
    placeholder: "https://visualgo.net/en/sorting",
    errorMsg: "Неверная ссылка. Ожидается ссылка на VisuAlgo (visualgo.net/...)",
    description: "Визуализация алгоритмов и структур данных",
  },

  p5js: {
    name: "p5.js Web Editor",
    embedSupported: true,
    urlPattern: /^https?:\/\/editor\.p5js\.org(\/[\w-]+\/sketches\/[\w-]+(\/full)?)?\/?$/i,
    extractEmbedUrl: (url) => {
      const trimmed = url.trim();
      const match = trimmed.match(/(.*\/sketches\/[\w-]+)/);
      const base = match?.[1];
      if (base) return base.endsWith("/full") ? base : `${base}/full`;
      return "https://editor.p5js.org/";
    },
    placeholder: "https://editor.p5js.org/ (пусто) или https://editor.p5js.org/username/sketches/abc123",
    errorMsg: "Неверная ссылка. Ожидается ссылка на p5.js Web Editor (editor.p5js.org/...)",
    description: "Creative coding — рисование и анимация через JavaScript",
  },

  excalidraw: {
    name: "Excalidraw",
    embedSupported: true,
    urlPattern: /^https?:\/\/excalidraw\.com\/?(#room=[\w,]+)?/i,
    extractEmbedUrl: (url) => url.trim(),
    placeholder: "https://excalidraw.com/ или https://excalidraw.com/#room=abc,xyz",
    errorMsg: "Неверная ссылка. Ожидается ссылка на Excalidraw (excalidraw.com)",
    description: "Виртуальная доска для схем и диаграмм",
  },

  learningapps: {
    name: "Learning Apps",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?learningapps\.org\/.*/i,
    extractEmbedUrl: (url) => {
      const trimmed = url.trim();
      const match = trimmed.match(/[?&]app=(\w+)/);
      return match ? `https://learningapps.org/watch?app=${match[1]}` : trimmed;
    },
    placeholder: "https://learningapps.org/watch?app=pXXXXXXXk21",
    errorMsg: "Неверная ссылка. Ожидается ссылка на LearningApps (learningapps.org/...)",
    description: "Интерактивные упражнения и мини-игры для уроков",
  },

  sqlonline: {
    name: "SQL Online",
    embedSupported: true,
    // Spec originally named sqliteonline.com, but that domain sends
    // X-Frame-Options: SAMEORIGIN (verified via curl -I — blocks iframing).
    // Substituted sqlime.org (client-side SQLite playground, verified
    // iframe-clean via curl -I, no X-Frame-Options/CSP frame-ancestors).
    urlPattern: /^https?:\/\/(www\.)?sqlime\.org\/?.*/i,
    extractEmbedUrl: (url) => url.trim(),
    placeholder: "https://sqlime.org/",
    errorMsg: "Неверная ссылка. Ожидается ссылка на SQL-песочницу (sqlime.org)",
    description: "SQL-запросы в браузере (SQLite) — для старших классов",
  },

  h5p: {
    name: "H5P Interactive",
    embedSupported: true,
    // Teacher pastes a link to content they created in the self-hosted H5P
    // app's /editor (apps/h5p) — e.g. https://h5p.eduos.snruz.uz/player/<uuid>.
    urlPattern: /^https?:\/\/h5p\.eduos\.snruz\.uz\/player\/[\w-]+\/?$/i,
    extractEmbedUrl: (url) => url.trim().replace(/[?#].*$/, ""),
    placeholder: `${H5P_BASE_URL}/player/<content-id>`,
    errorMsg: `Неверная ссылка. Ожидается ссылка на задание из H5P (${H5P_BASE_URL}/player/...)`,
    description: "Интерактивные задания: memory games, квизы, drag-n-drop. Универсально для любых предметов",
  },
};

export function isExternalService(ct: string | null | undefined): ct is ExternalServiceType {
  return (
    ct === "wokwi" || ct === "codesandbox" ||
    ct === "geogebra" || ct === "phet" || ct === "desmos" || ct === "blockly_games" ||
    ct === "visualgo" || ct === "p5js" || ct === "excalidraw" || ct === "learningapps" ||
    ct === "sqlonline" || ct === "h5p"
  );
}

export function validateServiceUrl(
  service: ExternalServiceType,
  url: string,
): { valid: boolean; embedUrl: string | null; error: string | null } {
  const cfg = SERVICE_CONFIG[service];
  if (!cfg.urlPattern.test(url.trim())) {
    return { valid: false, embedUrl: null, error: cfg.errorMsg };
  }
  return { valid: true, embedUrl: cfg.extractEmbedUrl(url.trim()), error: null };
}
