// Whitelist + URL validation for the external-service lesson stages.
// All four services (scratch, wokwi, codesandbox, makecode) support iframe embed.

import type { ExternalServiceType } from "@snr/core";

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
  scratch: {
    name: "Scratch",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?scratch\.mit\.edu\/projects\/(\d+)/,
    extractEmbedUrl: (url) => {
      const match = url.match(/projects\/(\d+)/);
      return match ? `https://scratch.mit.edu/projects/${match[1]}/embed` : null;
    },
    placeholder: "https://scratch.mit.edu/projects/123456789/",
    errorMsg: "Неверная ссылка. Ожидается ссылка на Scratch проект (scratch.mit.edu/projects/...)",
    description: "Создание интерактивных историй и игр через блоки",
  },

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

  makecode: {
    name: "MakeCode",
    embedSupported: true,
    // Accepts:
    // - makecode.com/_xyz   (short share URL from the Share button)
    // - arcade.makecode.com/12345-67890-... or arcade.makecode.com/_xyz
    // - makecode.microbit.org/_xyz or microbit.makecode.com/<id>  (micro:bit)
    // - minecraft.makecode.com/<id>
    urlPattern:
      /^https?:\/\/(?:(?:[\w-]+\.)?makecode\.com|makecode\.microbit\.org)\/[\w-]+/,
    extractEmbedUrl: (url) => {
      // Short share URL: makecode.com/_xyz → arcade embed
      const shortMatch = url.match(/(?<![.\w])makecode\.com\/(_[\w-]+)/);
      if (shortMatch) {
        return `https://arcade.makecode.com/---codeembed?pub=${shortMatch[1]}`;
      }
      // Arcade full URL
      const arcadeMatch = url.match(/arcade\.makecode\.com\/([\w-]+)/);
      if (arcadeMatch) {
        return `https://arcade.makecode.com/---codeembed?pub=${arcadeMatch[1]}`;
      }
      // micro:bit
      const microbitMatch = url.match(
        /(?:makecode\.microbit\.org|microbit\.makecode\.com)\/([\w-]+)/,
      );
      if (microbitMatch) {
        return `https://makecode.microbit.org/---codeembed?pub=${microbitMatch[1]}`;
      }
      return null;
    },
    placeholder: "https://makecode.com/_xyz123 или https://arcade.makecode.com/12345-67890-...",
    errorMsg:
      "Неверная ссылка. Ожидается ссылка на проект MakeCode (makecode.com или arcade.makecode.com)",
    description: "Создание игр, micro:bit, Minecraft через Microsoft MakeCode",
  },
};

export function isExternalService(ct: string | null | undefined): ct is ExternalServiceType {
  return ct === "scratch" || ct === "wokwi" || ct === "codesandbox" || ct === "makecode";
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
