export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  // Служебный ключ нужен единственному месту — серверному прокси файлов H5P
  // (миграция 195 закрыла бакет). Не обязателен: без него прокси честно
  // отвечает 500, а всё остальное приложение работает на анонимном ключе.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  return { url, anonKey, serviceKey };
}
