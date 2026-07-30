// Заморозка "сегодня"/"сейчас" для демо (Большой фикс: React #310 +
// заморозка даты + cron). NEXT_PUBLIC_DEMO_FROZEN_DATE ("YYYY-MM-DD") —
// пока задана, весь UI-фронтенд считает эту дату "сегодня", в полдень по
// Ташкенту (нейтральная точка суток — не задевает границы дня ни в одном
// часовом поясе браузера). Сброс — удалить переменную из .env.local.
//
// NEXT_PUBLIC_* инлайнится в клиентский бандл ТОЛЬКО на next build — правка
// .env.local на уже собранном/задеплоенном (Vercel) приложении требует
// нового build/deploy, не просто перезапуска. На next dev обычно
// подхватывается на лету (Next перекомпилирует при изменении .env*), но не
// гарантированно мгновенно.
//
// getDemoNow()/getDemoNowMs() безопасны и в клиентских, и в серверных
// компонентах (просто process.env.*, без window/document) — используются
// только в UI-слое (компоненты фронтенда), НЕ в API-роутах/server actions/
// скриптах/packages/core, где нужно реальное время (см. resheniya_2.md).

export function getDemoNow(): Date {
  const frozen = process.env.NEXT_PUBLIC_DEMO_FROZEN_DATE;
  if (frozen) {
    return new Date(`${frozen}T12:00:00+05:00`); // Ташкент полдень
  }
  return new Date();
}

export function getDemoNowMs(): number {
  return getDemoNow().getTime();
}

export function isDemoMode(): boolean {
  return !!process.env.NEXT_PUBLIC_DEMO_FROZEN_DATE;
}
