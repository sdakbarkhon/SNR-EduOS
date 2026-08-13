"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";
import { signInWithUsername } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreDemoLessonShape } from "@/app/api/cron/_lib/restore-demo-shape";
import { DEMO_SESSION_COOKIE } from "@/lib/single-session";
import { registerSession } from "@/lib/register-session";
import { schoolNow } from "@/lib/school-time";
import { getMySchoolFrozenDate } from "@/lib/school-time-server";

// P2 (пачка 2) — переработка демо-режима. demoLogin — «серверный wrapper»
// для DemoRoleModal: RPC claim_demo_slot → signInWithPassword → cookies.
//
// 10.08.2026 — ЭТО ЕДИНСТВЕННЫЙ ПУТЬ ВЫДАЧИ ДЕМО-СЛОТА. Публичный
// POST /api/demo/claim удалён: он был открыт без всякой авторизации и
// возвращал в теле ответа адрес и пароль выданного аккаунта текстом. Живых
// вызовов у него не было — мобильная обёртка claimDemoSlot ниоткуда не
// импортировалась. Соседние /api/demo/heartbeat и /api/demo/release
// оставлены: их зовёт мобильное приложение, и доступа они не выдают —
// работают по ключу уже существующей аренды.

type LoginResult =
  | { ok: true; dest: string; isDemo: boolean }
  // reason — машиночитаемая причина для лога на клиенте. Раньше сюда не
  // доезжало ничего: server action возвращает объект, а не бросает, поэтому
  // catch с console.error на клиенте был недостижим и консоль оставалась
  // пустой при видимой пользователю ошибке (07.08.2026).
  // demo_unavailable — миграция 183: демо-школа не настроена (флаг is_demo
  // не стоит ни на одной школе или стоит сразу на двух). Отделён от
  // all_busy намеренно: «мест нет, зайдите позже» и «демо сломано» — разные
  // сообщения, и смешивать их значит врать посетителю про причину.
  | { ok: false; error: "invalid" | "failed" | "all_busy" | "demo_unavailable"; reason?: string }
  // Z.2.10 — один логин в нескольких школах: спрашиваем, в какую входить.
  // reason здесь не используется, но объявлен: DemoRoleModal читает
  // result.reason на всём объединении, и без него сужение по error ломается.
  | { ok: false; error: "pick_school"; schools: Array<{ id: string; name: string }>; reason?: string };

/**
 * Z.2.10 — резолвер «логин → в каких школах он есть».
 *
 * Зачем. Логин превращается в служебный адрес без участия школы, а адреса
 * уникальны глобально. С Z.2.10 второй одноимённый аккаунт получает адрес со
 * школьным кодом (`ivanov.snr-real@…`, см. createSchoolScopedUser в
 * admin-api.ts), и обычная попытка по простому адресу для него не сработает.
 *
 * Живёт на сервере и ходит служебным клиентом НАМЕРЕННО: адрес учётной
 * записи наружу не отдаётся, в браузер уходит только список школ. Поэтому
 * никакой RPC и никакой миграции — резолвер это обычный запрос под
 * service-role.
 *
 * Существующие адреса не мигрированы: у кого простой адрес, тот и найдётся
 * по нему первым же шагом, сюда дело не дойдёт.
 */
async function resolveLoginCandidates(
  username: string,
): Promise<Array<{ schoolId: string; schoolName: string; email: string }>> {
  const login = username.trim().toLowerCase();
  if (!login || login.includes("@")) return [];

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyAdmin = admin as any;

  const [students, teachers, admins] = await Promise.all([
    anyAdmin.from("students").select("user_id, school_id").ilike("username", login),
    anyAdmin.from("teachers").select("user_id, school_id").ilike("username", login),
    // Миграция 194 — у админов появилась своя колонка логина. До неё здесь
    // стоял пустой список, и администратор, которому при столкновении логинов
    // достался школьный адрес (`логин.код@admins.snr.local`), не мог войти
    // вообще: по логину его не находили, а простой адрес занят чужой школой.
    anyAdmin.from("admins").select("user_id, school_id").ilike("username", login),
  ]);

  const rows = [
    ...((students.data ?? []) as Array<{ user_id: string | null; school_id: string }>),
    ...((teachers.data ?? []) as Array<{ user_id: string | null; school_id: string }>),
    ...((admins.data ?? []) as Array<{ user_id: string | null; school_id: string }>),
  ].filter((r) => r.user_id);
  if (rows.length === 0) return [];

  const { data: schools } = await anyAdmin.from("schools").select("id, name");
  const schoolName = new Map(
    ((schools ?? []) as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]),
  );

  const resolved = await Promise.all(rows.map(async (r) => {
    const { data } = await admin.auth.admin.getUserById(r.user_id!);
    const email = data?.user?.email;
    return email
      ? { schoolId: r.school_id, schoolName: schoolName.get(r.school_id) ?? "—", email }
      : null;
  }));

  // Один и тот же адрес не должен встретиться дважды (ученик и учитель с
  // одним user_id — невозможно, но подстрахуемся).
  const seen = new Set<string>();
  return resolved.filter((c): c is NonNullable<typeof c> => {
    if (!c || seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });
}

/** Общий хвост успешного входа: сессия, снятие демо-куки, адрес назначения. */
async function finishLogin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string },
  accessToken: string,
): Promise<LoginResult> {
  await registerSession({ userId: user.id, accessToken });
  (await cookies()).delete(DEMO_SESSION_COOKIE);
  return { ok: true, dest: await resolveDest(supabase, user.id), isDemo: false };
}

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
  // Обычный путь — как был. Сегодня он закрывает 100% случаев, потому что
  // школьный адрес получают только одноимённые аккаунты второй школы.
  const result = await signInWithUsername(supabase, username, password);
  if (!result.error && result.data?.user && result.data.session) {
    // Обычный логин — не демо. Cookie DEMO_SESSION_COOKIE ставится ТОЛЬКО
    // при demoLogin. Здесь защитно снимаем, если она осталась от предыдущей
    // демо-сессии этого же браузера.
    return finishLogin(supabase, result.data.user, result.data.session.access_token);
  }

  // Z.2.10 — не вышло по простому адресу: возможно, логин живёт во второй
  // школе со школьным адресом.
  const candidates = await resolveLoginCandidates(username);
  if (candidates.length === 0) return { ok: false, error: "invalid" };

  if (candidates.length === 1) {
    const only = candidates[0]!;
    const single = await supabase.auth.signInWithPassword({ email: only.email, password });
    if (single.error || !single.data.user || !single.data.session) {
      return { ok: false, error: "invalid" };
    }
    return finishLogin(supabase, single.data.user, single.data.session.access_token);
  }

  // Настоящая коллизия: логин есть в нескольких школах. Пароль здесь НЕ
  // проверяем — иначе форма превратилась бы в способ узнать, в какой школе
  // он подходит. Спрашиваем школу и проверяем пароль уже под неё.
  return {
    ok: false,
    error: "pick_school",
    schools: candidates.map((c) => ({ id: c.schoolId, name: c.schoolName })),
  };
}

/** Z.2.10 — второй шаг входа: школа выбрана, адрес известен серверу. */
export async function loginWithUsernameInSchool(
  username: string,
  password: string,
  schoolId: string,
): Promise<LoginResult> {
  const supabase = await createClient();
  const candidates = await resolveLoginCandidates(username);
  const match = candidates.find((c) => c.schoolId === schoolId);
  if (!match) return { ok: false, error: "invalid" };

  const signed = await supabase.auth.signInWithPassword({ email: match.email, password });
  if (signed.error || !signed.data.user || !signed.data.session) {
    return { ok: false, error: "invalid" };
  }
  return finishLogin(supabase, signed.data.user, signed.data.session.access_token);
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
      // Миграция 183: демо-школ не одна (ноль или больше одной). Функция в
      // этом случае принципиально не берёт «первую попавшуюся» — иначе
      // фильтр по школе не давал бы никакой гарантии. Повтор так же
      // бессмыслен, как и при занятости пула: состояние не изменится само.
      if (msg.includes("demo_school_not_configured")) {
        console.error(
          "[demoLogin] демо-школа не настроена: schools.is_demo=true должен стоять ровно у одной школы",
        );
        return { ok: false, error: "demo_unavailable" };
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

  // 08.08.2026 — ЭТАЛОННАЯ ФОРМА УРОКОВ ВОССТАНАВЛИВАЕТСЯ ЗДЕСЬ, при входе в
  // демо. Это основная защита; ночной крон — только подстраховка.
  //
  // Почему не крон. Форма расползается закономерно, а не от поломки: чтобы
  // показать «начать урок вручную», посетитель стартует 3-й слот, и триггер
  // trg_close_other_in_progress_lessons честно закрывает 2-й. То есть демо
  // САМО ломает форму — вопрос лишь в том, как быстро она вернётся. Раз в
  // сутки для этого мало: заказчик показывает клиентам среди дня.
  //
  // Почему именно вход. Это единственный момент, когда форма ТОЧНО должна
  // быть эталонной, и он же — начало каждого показа. Восстановление на
  // рендере расписания пришлось бы делать записью во время GET; запрет
  // ученику завершать урок убил бы саму демонстрируемую функцию.
  //
  // Ошибку глушим намеренно: невозможность починить демо-данные не повод не
  // пустить человека в демо.
  try {
    const res = await restoreDemoLessonShape(admin);
    if (res.changed > 0) {
      console.log(`[demoLogin] форма уроков восстановлена: ${res.changed} правок`, res.byPhase);
    }
  } catch (e) {
    console.error("[demoLogin] restoreDemoLessonShape failed:", (e as Error)?.message ?? e);
  }

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

/**
 * Выход. Параметр dest — куда вернуть пользователя.
 *
 * По умолчанию ученический /login, но у родителя СВОЙ экран входа (телефон
 * и код): выходя из родительского кабинета, он попадал на форму с логином,
 * паролем, кнопкой демо и значками Google/Microsoft — чужую дверь.
 * Параметр необязательный, поэтому все прежние вызовы работают как раньше.
 */
export async function signOut(dest: string = "/login") {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const cookieStore = await cookies();
  const demoToken = cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null;

  // Z.3, заход 2 — школу узнаём ЗДЕСЬ, пока сессия жива, и уносим значение в
  // замыкание. Внутри after() это уже невозможно: блок выполняется после
  // ответа, к тому моменту ниже отработал signOut, и current_school_id()
  // (он стоит на auth.uid()) вернул бы NULL. Служебный клиент внутри after()
  // тоже не помог бы — под service-role auth.uid() нет по определению.
  const frozenDate = userId ? await getMySchoolFrozenDate(supabase) : null;

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
        .update({ last_activity: schoolNow(frozenDate).toISOString() })
        .eq("user_id", userId);
    }
  });

  // scope:'local' — глобальный signOut отозвал бы refresh-токен сессии,
  // которая только что вытеснила эту.
  await supabase.auth.signOut({ scope: "local" });
  cookieStore.delete(DEMO_SESSION_COOKIE);
  redirect(dest);
}
