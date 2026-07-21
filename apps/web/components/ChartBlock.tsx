"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FunctionPlotDatumScope } from "function-plot";
import { parseChartSpec, compileChartFunction } from "@/lib/chart-spec";

/**
 * Рендерит блок ```chart из ответа AI-ассистента в настоящий график —
 * AI выдаёт только expr/domain (формат — lib/chart-spec.ts, синхронизирован
 * с системным промптом в AiFloatingChat.tsx), весь код построения графика
 * живёт здесь, на фронте. AI ничего не рисует сам.
 *
 * function-plot загружается динамически (import() внутри useEffect, а не
 * статическим import) — эта связка (+ d3 внутри неё) довольно тяжёлая, а
 * AiFloatingChat.tsx, где рендерятся сообщения, статически подключается в
 * AiFloatingButton.tsx → AppShell.tsx, то есть попадает в бандл КАЖДОЙ
 * страницы ученика. Динамический импорт держит function-plot вне этого
 * бандла — грузится только когда AI реально прислал chart-блок (редкий
 * случай), а не для каждого студента на каждой странице.
 *
 * fn передаётся в function-plot как ГОТОВАЯ JS-функция (не строка) — то
 * есть function-plot вообще не парсит выражение сам, единственный парсер
 * во всей цепочке — mathjs внутри compileChartFunction (см. chart-spec.ts).
 */
export function ChartBlock({ spec }: { spec: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderFailed, setRenderFailed] = useState(false);

  const parsed = useMemo(() => parseChartSpec(spec), [spec]);
  const fn = useMemo(() => (parsed ? compileChartFunction(parsed.expr, parsed.domain) : null), [parsed]);

  useEffect(() => {
    setRenderFailed(false);
    if (!parsed || !fn || !containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = "";
    let cancelled = false;

    import("function-plot")
      .then(({ default: functionPlot }) => {
        if (cancelled || !el) return;
        try {
          functionPlot({
            target: el,
            width: Math.min(el.clientWidth || 300, 420),
            height: 240,
            grid: true,
            xAxis: { domain: parsed.domain },
            data: [{ fn: (scope: FunctionPlotDatumScope) => fn(scope.x as number), graphType: "polyline" }],
          });
        } catch {
          setRenderFailed(true);
        }
      })
      .catch(() => setRenderFailed(true));

    return () => {
      cancelled = true;
    };
  }, [parsed, fn]);

  if (!parsed || !fn || renderFailed) {
    return (
      <div className="my-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Не удалось построить график
      </div>
    );
  }

  return <div ref={containerRef} className="my-1 overflow-hidden rounded-xl border border-slate-200 bg-white" />;
}
