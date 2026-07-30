import { bgPageCss, blobs } from "@/lib/parent/glass-tokens";

/**
 * Фон страницы: градиент + 4 размытых блоба, дословно из мобильных токенов.
 *
 * ТЁМНАЯ ТЕМА. Ни градиент, ни цвета блобов здесь не хардкодятся — оба
 * приезжают из токенов как `var(--p-*)` и разрешаются браузером по классу
 * `dark` на <html> (значения — apps/web/app/parent/parent-theme.css).
 * Поэтому компонент один на обе схемы, а различия чисто «данные»:
 *   * геометрия (size/top/left/…) в обеих темах ОДИНАКОВАЯ;
 *   * у циана и розового в тёмной теме ниже альфа (.42→.30, .40→.26);
 *   * четвёртый (синий) блоб в тёмной теме прототипом спрятан целиком —
 *     `--p-blob4: transparent`. Узел остаётся в DOM (он ничего не рисует и
 *     не ловит события), потому что альтернатива — читать активную тему на
 *     сервере, чего этот серверный компонент как раз и не умеет.
 */
export function GlassBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: bgPageCss }}
    >
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
            background: b.color,
            filter: "blur(60px)",
          }}
        />
      ))}
    </div>
  );
}
