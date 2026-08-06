// frozen forever 29.07.2026 10:50 Tashkent — client requirement 05.08.2026
//
// Раньше — переключаемая демо-заморозка через NEXT_PUBLIC_DEMO_FROZEN_DATE
// (полдень Ташкента, нейтральная точка суток). По решению заказчика
// заморозка теперь навсегда, тумблер больше не нужен — хардкод-константа
// вместо env var. Якорь — 10:50 Ташкент, а не полдень: это перемена между
// 2-м и 3-м уроком (правило "1-completed / 2-in_progress / 3+ ручной
// старт" встаёт естественно — 1-й урок уже завершён, 2-й уже идёт, 3-й ещё
// не активирован).
//
// getDemoNow()/getDemoNowMs() безопасны и в клиентских, и в серверных
// компонентах (чистая константа, без window/document) — используются
// только в UI-слое (компоненты фронтенда) и SSR/server actions/API routes,
// куда их явно прокинули (см. resheniya_2.md) — НЕ в БД (updated_at/
// created_at пишутся реальным Postgres now()).

const FROZEN_AT_ISO = "2026-07-29T10:50:00+05:00"; // = 2026-07-29T05:50:00.000Z

export function getDemoNow(): Date {
  return new Date(FROZEN_AT_ISO);
}

export function getDemoNowMs(): number {
  return getDemoNow().getTime();
}

export function isDemoMode(): boolean {
  return true;
}
