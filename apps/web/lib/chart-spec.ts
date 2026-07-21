import { parse } from "mathjs";

// mathjs.parse — полный набор функций (sin/cos/sqrt/^/неявное умножение и
// т.д.), собственный AST-парсер выражений, НЕ eval, не имеет доступа к
// JS-глобалям/require/process.

export interface ChartSpec {
  expr: string;
  domain: [number, number];
}

/**
 * Парсит блок ```chart из ответа AI-ассистента — формат СИНХРОНИЗИРОВАН с
 * системным промптом (AiFloatingChat.tsx, STUDENT_SYSTEM):
 *   type: function
 *   expr: x^2
 *   domain: -5, 5
 * "type" опционален — единственный поддерживаемый вариант "function", любое
 * другое значение отклоняется (null → фронт покажет "не удалось построить").
 * "domain" опционален, по умолчанию [-10, 10].
 */
export function parseChartSpec(raw: string): ChartSpec | null {
  const fields: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    fields[key] = value;
  }

  if (fields.type && fields.type.toLowerCase() !== "function") return null;
  if (!fields.expr) return null;

  const domainRaw = fields.domain ?? "-10, 10";
  const parts = domainRaw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 2) return null;
  const [lo, hi] = parts;
  if (lo === undefined || hi === undefined || !Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
    return null;
  }

  return { expr: fields.expr, domain: [lo, hi] };
}

/**
 * Компилирует expr через mathjs.parse().compile() — НЕ eval, mathjs строит
 * собственный AST и вычисляет его сам, не может достать до JS-глобалей.
 * Возвращает функцию y=f(x), либо null если выражение не парсится или не
 * даёт число на пробной точке (середина домена) — единая точка входа для
 * "безопасно ли это выражение", используется и графиком, и тестами.
 */
export function compileChartFunction(expr: string, domain: [number, number]): ((x: number) => number) | null {
  try {
    const compiled = parse(expr).compile();
    const probe: unknown = compiled.evaluate({ x: (domain[0] + domain[1]) / 2 });
    if (typeof probe !== "number" || !Number.isFinite(probe)) return null;
    return (x: number) => {
      const y: unknown = compiled.evaluate({ x });
      return typeof y === "number" ? y : NaN;
    };
  } catch {
    return null;
  }
}
