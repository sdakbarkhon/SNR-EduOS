import { bgPageCss, blobs } from "@/lib/parent/glass-tokens";

/** Фон страницы: градиент + 4 размытых блоба, дословно из мобильных токенов. */
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
