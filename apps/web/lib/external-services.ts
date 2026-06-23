// Whitelist + URL validation for the external-service lesson stages (Prompt 5).
// Scratch & Tinkercad can be embedded in an iframe (we derive an /embed URL).
// App Inventor & Code Monkey cannot be embedded — the student opens them in a
// new tab and attaches a result (link and/or screenshot).

import type { ExternalServiceType } from "@snr/core";

type ServiceMeta = {
  name: string;
  embedSupported: boolean;
  urlPattern: RegExp;
  extractEmbedUrl: (url: string) => string | null;
  placeholder: string;
  errorMsg: string;
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
  },
  tinkercad: {
    name: "Tinkercad",
    embedSupported: true,
    urlPattern: /^https?:\/\/(www\.)?tinkercad\.com\//,
    extractEmbedUrl: (url) => {
      // Tinkercad embed uses /embed/<id> instead of /things/<id>.
      const match = url.match(/tinkercad\.com\/(things|embed)\/([^/?]+)/);
      return match ? `https://www.tinkercad.com/embed/${match[2]}` : null;
    },
    placeholder: "https://www.tinkercad.com/things/abc123-circuit-name",
    errorMsg: "Неверная ссылка. Ожидается ссылка на публичный проект Tinkercad. Проект должен быть публичным.",
  },
  app_inventor: {
    name: "MIT App Inventor",
    embedSupported: false,
    urlPattern: /^https?:\/\/.+/,
    extractEmbedUrl: () => null,
    placeholder: "https://ai2.appinventor.mit.edu/",
    errorMsg: "Введите корректную ссылку (https://…)",
  },
  code_monkey: {
    name: "Code Monkey",
    embedSupported: false,
    urlPattern: /^https?:\/\/.+/,
    extractEmbedUrl: () => null,
    placeholder: "https://www.codemonkey.com/",
    errorMsg: "Введите корректную ссылку (https://…)",
  },
};

export function isExternalService(ct: string | null | undefined): ct is ExternalServiceType {
  return ct === "scratch" || ct === "tinkercad" || ct === "app_inventor" || ct === "code_monkey";
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
