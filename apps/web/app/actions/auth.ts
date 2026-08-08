"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { signInWithUsername } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { registerSession } from "@/lib/register-session";
import { getDemoNow } from "@/lib/demo-date";

// P2 (пачка 2) — переработка демо-режима. Демо-логика теперь живёт в
// endpoints apps/web/app/api/demo/*, но demoLogin остаётся как «серверный
// wrapper» для DemoRoleModal (там уже был контракт server action —
// сохраняем для минимальных изменений в UI). Внутри он ровно то же,
// что делает /api/demo/claim: RPC claim_demo_slot → signInWithPassword →
// cookies.

type LoginResult =
  | { ok: true; dest: string; isDemo: boolean }
  // reason — машиночитаемая причина для лога на клиенте. Раньше сюда не
  // доезжало ничего: server action возвращает объект, а не бросает, поэтому
  // catch с console.error на клиенте был недостижим и консоль оставалась
  // пустой при видимой пользователю ошибке (07.08.2026).
  | { ok: false; error: "invalid" | "failed" | "all_busy"; reason?: string };

interface ClaimSlotRow {
  username: string | null;
  email: string;
  password: string;
  session_token: string;
  user_id: string;
}

/** Приоритет как в middleware: super_admin > admin > parent > teacher > student. */
async function resolveDest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const [superAdminRes, adminRes, parentRes, teacherRes] = await Promise.all([
    supabase.from("super_admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("parents").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (superAdminRes.data) return "/superadmin/dashboard";
  if (adminRes.data) return "/admin";
  if (parentRes.data) return "/parent/home";
  if (teacherRes.data) return "/teacher/dashboard";
  return "/dashboard";
}

export async function loginWithUsername(
  username: string,
  password: string,
): Promise<LoginResult> {
  const supabase = await createClient();
  const result = await signInWithUsername(supabase, username, password);
  if (result.error || !result.data?.user || !result.data.session) {
    return { ok: false, error: "invalid" };
  }

  const user = result.data.user;
  await registerSession({
    userId: user.id,
    accessToken: result.data.session.access_token,
  });

  // Обычный логин — не демо. Cookie DEMO_SESSION_COOKIE ставится ТОЛЬКО
  // при demoLogin (или endpoint /api/demo/claim). Здесь защитно снимаем
  // если она осталась от предыдущей демо-сессии этого же браузера.
  (await cookies()).delete(DEMO_SESSION_COOKIE);

  return { ok: true, dest: await resolveDest(supabase, user.id), isDemo: false };
}

export async function demoLogin(
  target:
    | { kind: "teacher"; slug: "programming" | "robotics" | "math" | "english" | "russian" }
    | { kind: "student"; gradeLevel?: 3 | 7 | 10 }
    | { kind: "parent" },
): Promise<LoginResult> {
  const admin = createAdminClient();
  const supabase = await createClient();

  const role = target.kind;
  const subjectSlug = target.kind === "teacher" ? target.slug : null;
  // P3-фикс: карточка класса в DemoRoleModal передаёт gradeLevel — случайный
  // ученик берётся ТОЛЬКО из этого класса (миграция 135, students.grade).
  const gradeLevel = target.kind === "student" ? target.gradeLevel ?? null : null;

  // 07.08.2026 — повтор с ДРУГИМ слотом вместо ошибки на первой попытке.
  //
  // Симптом заказчика: «иногда пишет "не удалось войти в демо-режим", со
  // второго раза заходит», в консоли браузера пусто. Механизм виден прямо в
  // demo_leases: часть аккаунтов пула откатывается через доли секунды после
  // выдачи и НИКОГДА не даёт рабочую сессию (у одного 3 аренды из 3 такие),
  // а следующий клик берёт другой аккаунт и заходит. То есть claim проходит,
  // а signInWithPassword под выданной учёткой не проходит — функция
  // claim_demo_slot возвращает пароль литералом и не проверяет, что аккаунт
  // им действительно открывается.
  //
  // Пустая консоль объясняется отдельно: server action не бросает, а
  // ВОЗВРАЩАЕТ { ok: false } — единственный console.error на клиенте лежит в
  // catch, который на этом пути недостижим. Диагностика уходила только в лог
  // сервера, поэтому «в консоли пусто».
  //
  // Чинить сам пароль отсюда нельзя (это правка учётных данных в проде, шаг
  // заказчика — см. отчёт). Но пользователю видеть эту ошибку незачем:
  // берём следующий слот. Плохой аккаунт при этом уже освобождён, а выбор
  // ученика идёт ORDER BY random(), так что повтор почти всегда попадает в
  // другой.
  const ATTEMPTS = 3;
  let row: ClaimSlotRow | null = null;
  let signedIn: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
  let lastReason = "";

  for (let attempt = 0; attempt < ATTEMPTS && !signedIn; attempt++) {
    // 1) claim slot через RPC (миграции 133/135).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimed, error: claimError } = await (admin.rpc as any)("claim_demo_slot", {
      p_role: role,
      p_subject_slug: subjectSlug,
      p_grade_level: gradeLevel,
    });
    if (claimError) {
      const msg = claimError.message ?? "";
      if (msg.includes("no_available_slot")) {
        // Свободных слотов нет — повторять бессмысленно, ответ честный.
        return { ok: false, error: "all_busy" };
      }
      console.error("[demoLogin] claim rpc error:", claimError);
      return { ok: false, error: "failed", reason: "claim_failed" };
    }
    const candidate = (claimed as ClaimSlotRow[] | null)?.[0];
    if (!candidate) return { ok: false, error: "all_busy" };

    // 2) signIn под этим email — Supabase server client ставит auth cookies.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: candidate.email,
      password: candidate.password,
    });
    if (error || !data.session) {
      // Rollback lease чтобы не залипло на 15 мин И чтобы следующая попытка
      // не считала этот аккаунт занятым.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("release_demo_slot", { p_session_token: candidate.session_token });
      lastReason = "signin_rejected";
      console.error(
        `[demoLogin] попытка ${attempt + 1}/${ATTEMPTS}: аккаунт ${candidate.username} не пускает —`,
        error?.message ?? "нет сессии",
      );
      continue;
    }
    row = candidate;
    signedIn = data;
  }

  if (!row || !signedIn) {
    console.error(`[demoLogin] все ${ATTEMPTS} попытки исчерпаны, причина: ${lastReason}`);
    return { ok: false, error: "failed", reason: lastReason || "signin_rejected" };
  }
  const data = signedIn;

  await registerSession({
    userId: data.user.id,
    accessToken: data.session.access_token,
  });

  // 3) ставим демо-cookie с session_token — используется useIsDemoSession,
  // DemoBanner, DemoHeartbeat и endpoint'ами heartbeat/release.
  (await cookies()).set(DEMO_SESSION_COOKIE, row.session_token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });

  const dest =
    role === "teacher" ? "/teacher/dashboard" :
    role === "parent"  ? "/parent/home"       :
                         "/dashboard";
  return { ok: true, dest, isDemo: true };
}

export async function signOut() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const cookieStore = await cookies();
  const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;

  // Release lease + штамп last_activity — best-effort (не блокируем редирект).
  after(async () => {
    const admin = createAdminClient();
    if (demoToken) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("release_demo_slot", { p_session_token: demoToken });
    }
    if (userId) {
      await admin
        .from("user_sessions")
        .update({ last_activity: getDemoNow().toISOString() })
        .eq("user_id", userId);
    }
  });

  // scope:'local' — глобальный signOut отозвал бы refresh-токен сессии,
  // которая только что вытеснила эту.
  await supabase.auth.signOut({ scope: "local" });
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect("/login");
}
