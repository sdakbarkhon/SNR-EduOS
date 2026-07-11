import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Промт «скорость», Задача 4: /api/* делает собственную auth-проверку
// (createClient().auth.getUser() в каждом route-хендлере) — middleware
// (session/role redirect-логика для страниц) для API-запросов избыточен
// и добавляет round trip к Frankfurt на каждый вызов. Статические файлы
// (шрифты/скрипты/карты источников/манифесты) не несут auth-состояния.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|woff|woff2|ttf|map|json|txt|xml)$).*)",
  ],
};
