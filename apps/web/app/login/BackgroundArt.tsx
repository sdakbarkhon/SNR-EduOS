import Image from "next/image";

// Hero photo from the Stitch export (design-reference/stitch/code.html),
// downloaded and self-hosted instead of hotlinking the Google CDN URL the
// design tool generated it under.
export function BackgroundArt() {
  return (
    // fixed (не absolute) — при min-h-screen (Промт 6.2) страница может быть
    // выше 100vh, absolute тогда растягивал бы/обрезал фон по высоте контента.
    // min-h-screen ЗДЕСЬ (а не на корневом div страницы) — inset-0 тянет
    // высоту по containing block (ScaleWrapper-обёртка при active=true, иначе
    // сам этот div), который теперь считается по реальной высоте контента, а
    // не искусственно раздут до 100vh; min-height остаётся полом, чтобы фон
    // всё равно не обрывался раньше низа реального экрана на короткой
    // странице — но, в отличие от min-h-screen на корне страницы, не тянет
    // за собой высоту fixed-элементов (BottomBar), которые считают отступы
    // от containing block, а не от контента.
    <div className="pointer-events-none fixed inset-0 z-0 min-h-screen overflow-hidden">
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
