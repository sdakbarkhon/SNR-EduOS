"use client";

/**
 * Общая error-граница «учебных» экранов веб-родителя.
 *
 * lib/parent-queries.ts СОЗНАТЕЛЬНО не глотает ошибки (в отличие от safeQuery):
 * тихая пустота на родительских экранах уже приводила к тому, что сбой RLS
 * выглядел как «у ребёнка нет уроков/ДЗ/отметок». Поэтому каждый мой маршрут
 * получает свою error.tsx поверх этого компонента: реальный сбой видно, и его
 * можно повторить, а «пусто» остаётся отдельным честным состоянием экрана.
 */

import { GlassCard } from "../v2/GlassCard";
import { accentGrad, ink1, ink2 } from "../v2/tokens";

export function StudyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ padding: 18, paddingTop: 80 }}>
      <GlassCard radius={20}>
        <div className="flex flex-col items-center text-center" style={{ padding: 22, gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: ink1 }}>Не удалось загрузить данные</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>
            {error.message || "Попробуйте ещё раз — соединение или доступ к данным дало сбой."}
          </span>
          <button
            type="button"
            onClick={reset}
            className="transition-transform active:scale-95"
            style={{
              marginTop: 4,
              paddingBlock: 9,
              paddingInline: 18,
              borderRadius: 12,
              background: accentGrad,
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Повторить
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

export default StudyError;
