import Image from "next/image";

// Hero photo from the Stitch export (design-reference/stitch/code.html),
// downloaded and self-hosted instead of hotlinking the Google CDN URL the
// design tool generated it under.
export function BackgroundArt() {
  return (
    // fixed (не absolute) — при min-h-screen (Промт 6.2) страница может быть
    // выше 100vh, absolute тогда растягивал бы/обрезал фон по высоте контента.
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <Image
        src="/login/hero-bg.jpg"
        alt=""
        fill
        priority
        quality={75}
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-white/40" />
    </div>
  );
}
