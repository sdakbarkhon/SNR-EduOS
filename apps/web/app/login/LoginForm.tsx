"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Lock, ArrowRight, Sparkles } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { loginWithUsername, loginWithUsernameInSchool } from "@/app/actions/auth";
import { DemoRoleModal } from "@/components/DemoRoleModal";
import { Logo } from "@/components/Logo";
import { SchoolMark } from "@/components/SchoolMark";
import { SchoolPickerModal, rememberSchool } from "./SchoolPicker";
import { resolveSchoolStep, type PublicSchool } from "./school-step";
import { startParentGoogleLogin } from "@/app/actions/parentGoogleAuth";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function LoginForm({
  locale,
  /** Список школ, пришедший в готовом HTML. `null` — сервер спросить не
   *  смог (см. lib/public-schools.ts): тогда список переспрашивает браузер,
   *  как было раньше. */
  initialSchools,
}: {
  locale: Locale;
  initialSchools: PublicSchool[] | null;
}) {
  const d = getDictionary(locale);
  const t = d.auth;
  const router = useRouter();

  // 18.08.2026 — ЗДЕСЬ БЫЛ useSearchParams(), И ИМЕННО ОН ПРЯТАЛ КАРТОЧКУ.
  //
  // Жалоба звучала как «карточка входа появляется через 2-3 секунды»: страница
  // открыта, слева картинка и логотип, справа пусто. Причина оказалась не в
  // скорости чего-либо, а в том, что карточки НЕ БЫЛО В HTML ВООБЩЕ. Проверено
  // на проде: `curl https://eduos.snruz.uz/login | grep 'type="password"'` —
  // ноль совпадений, единственные name= во всём документе это name="viewport"
  // и name="description". Левая колонка в том же HTML присутствовала.
  //
  // Так работает правило Next.js: компонент, читающий адресную строку через
  // useSearchParams(), при статической сборке из пререндера ИСКЛЮЧАЕТСЯ
  // целиком — сервер не знает адреса, по которому его откроют. Вместо него в
  // HTML кладётся fallback ближайшего Suspense, а он был fallback={null}. То
  // есть на месте карточки в готовой странице лежала пустота, и появлялась
  // карточка не «через 2-3 секунды после запроса», а только когда браузер
  // скачает и выполнит 363 КБ сжатого JS. Отсюда и ощущение задержки, никак не
  // связанное с прошлым ускорением списка школ (тот запрос кэшируется и
  // отвечает за 100 мс — проверено, X-Vercel-Cache: HIT).
  //
  // Адресная строка нужна здесь трижды, и НИ РАЗУ на первом кадре: подставить
  // логин после /parent/join, показать «сессию заняли на другом устройстве» и
  // перевести отказ, с которым вернул Google. Всё это спокойно читается из
  // window.location.search после монтирования — а карточка за это не платит.
  //
  // НЕ ВОЗВРАЩАЙ СЮДА useSearchParams(). Если понадобится читать адрес —
  // читай его в useEffect, как ниже.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Z.2.10 — второй шаг появляется ТОЛЬКО при настоящей коллизии: один логин
  // заведён в нескольких школах. Пока населена одна школа, он недостижим.
  const [schoolChoices, setSchoolChoices] = useState<Array<{ id: string; name: string }> | null>(null);

  // 18.08.2026 — первый шаг входа: выбор школы.
  //
  // `null` — шаг ещё идёт, форма логина не показана. Как только шаг пройден
  // (школа выбрана, или школ нет, или человек вошёл без выбора), сюда
  // ложится объект: `school` — выбранная школа либо null.
  //
  // Проверка «свой ли это логин для выбранной школы» живёт НА СЕРВЕРЕ
  // (finishLogin). Здесь только показ: браузеру такие решения не доверяем.
  //
  // 19.08.2026 — НАЧАЛЬНОЕ ЗНАЧЕНИЕ СЧИТАЕТСЯ НА СЕРВЕРЕ, И ЭТО ВСЯ ПРАВКА
  // ПРОТИВ МЕЛЬКАНИЯ ЗАГОЛОВКА.
  //
  // Раньше здесь стоял безусловный null: сервер про школу не знал ничего,
  // рисовал общий заголовок «Вход в кабинет», а через секунду с лишним
  // браузер читал память и подменял его логотипом школы. Теперь список школ
  // приезжает в HTML (app/login/page.tsx), и сервер решает ровно то, что
  // может решить, — правилом resolveSchoolStep, тем же, которым потом
  // пользуется браузер:
  //
  //   школа одна   → подставлена уже в HTML, подменять нечего;
  //   школ ноль    → шага нет, сразу форма с заголовком;
  //   школ много   → null, то есть «пока не знаю» — и на месте шапки стоит
  //                  место под школу, а не чужой заголовок (ниже).
  //
  // rememberedId здесь НЕ передаётся намеренно: на сервере его нет, а
  // читать localStorage на первом рендере в браузере нельзя — разметка
  // разойдётся с серверной, и React перерисует всё заново. Память читает
  // окно выбора, уже после гидратации.
  const [picked, setPicked] = useState<{ school: PublicSchool | null } | null>(() => {
    if (initialSchools === null) return null;
    const step = resolveSchoolStep(initialSchools, null);
    if (step.kind === "pick") return { school: step.school };
    if (step.kind === "skip") return { school: null };
    return null;
  });
  /** Окно открыто повторно по «Сменить школу». Отличается тем, что не
   *  подставляет ни запомненное, ни единственную школу: человек пришёл сюда
   *  именно затем, чтобы выбрать другую. */
  const [reopenPicker, setReopenPicker] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Запомненный выбор подставляет сам SchoolPicker: список у него уже есть, и
  // название с логотипом он берёт оттуда же. Здесь про localStorage знать
  // незачем — кроме кнопки «Сменить школу» ниже.
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // Логин, подставленный после /parent/join, чтобы родителю не набирать
  // заново тот, который он только что придумал. Один раз при монтировании и
  // больше никогда: смена языка не должна затирать то, что человек уже успел
  // набрать сам.
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("username");
    if (u) setUsername(u);
  }, []);

  // Single-session: middleware выкинул эту сессию, потому что тем же
  // аккаунтом вошли с другого устройства. Постоянный error-pill, не
  // 2.5-секундный notice — сообщение должно дожить до взгляда пользователя.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("reason") === "session_replaced") {
      setError(t.sessionReplaced);
    }
    // Возврат от Google с отказом: причина приезжает в адресе, экран переводит
    // её на язык человека. Молчания быть не должно — человек только что
    // прошёл через чужой экран входа и вернулся ни с чем.
    const g = q.get("error");
    if (g === "not_linked") setError(t.googleNotLinked);
    else if (g === "no_account") setError(t.googleNoAccount);
    else if (g === "school_archived") setError(t.googleSchoolArchived);
    else if (g === "wrong_school") setError(t.googleWrongSchool);
    else if (g === "demo_school") setError(t.googleDemoSchool);
    else if (g === "failed") setError(t.googleFailed);
    // «cancelled» — не ошибка: человек сам нажал «Отмена» у Google.
    // Зависимость от t сохранена намеренно: сменил человек язык — сообщение
    // должно перечитаться на новом.
  }, [t]);

  // Warm the two most likely post-login route bundles so the RSC payload
  // isn't fetched cold the instant login succeeds (Iter5 hotfix P14.1).
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/teacher/dashboard");
  }, [router]);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  /** Z.2.10 — школа выбрана: пароль проверяется уже под её учётную запись. */
  async function onPickSchool(schoolId: string) {
    setLoading(true);
    setError(null);
    let result: Awaited<ReturnType<typeof loginWithUsernameInSchool>>;
    try {
      result = await loginWithUsernameInSchool(username, password, schoolId);
    } catch {
      setLoading(false);
      setError(t.invalid);
      return;
    }
    if (!result.ok) {
      setLoading(false);
      setSchoolChoices(null);
      setError(result.error === "wrong_school" ? t.wrongSchool : t.invalid);
      return;
    }
    const dest = result.dest;
    startTransition(() => {
      router.replace(dest);
      router.refresh();
    });
  }

  /**
   * Вход через Google. Механизм тот же, что у родителей: серверное действие
   * начинает вход (секрет PKCE должен лечь в HttpOnly-cookie сервера), браузер
   * уходит к Google, возврат обрабатывает /auth/callback.
   *
   * Выбранная школа уезжает вместе с адресом возврата и сверяется там: ученик
   * школы А, выбравший школу Б, войти не должен.
   */
  async function onGoogle() {
    setGoogleBusy(true);
    setError(null);
    try {
      const res = await startParentGoogleLogin(
        window.location.origin,
        picked?.school?.id ?? null,
        "login",
      );
      if (!res.ok) { setError(t.googleFailed); setGoogleBusy(false); return; }
      window.location.href = res.url;
    } catch {
      setError(t.googleFailed);
      setGoogleBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Single-session: логин через server action — там ставятся auth-cookie,
    // регистрируется user_sessions-строка (вытесняя предыдущую сессию этого
    // аккаунта) и вычисляется destination по ролям (super_admin > admin >
    // parent > teacher > student).
    let result: Awaited<ReturnType<typeof loginWithUsername>>;
    try {
      result = await loginWithUsername(username, password, picked?.school?.id ?? null);
    } catch {
      setLoading(false);
      setError(t.invalid);
      return;
    }
    if (!result.ok) {
      setLoading(false);
      if (result.error === "pick_school") {
        setSchoolChoices(result.schools);
        return;
      }
      // Пароль верный, но логин из другой школы. Говорить «неверный логин или
      // пароль» здесь было бы прямой неправдой, и человек искал бы опечатку
      // там, где её нет.
      if (result.error === "wrong_school") {
        setError(result.schoolName
          ? t.wrongSchoolNamed.replace("{name}", result.schoolName)
          : t.wrongSchool);
        return;
      }
      setError(t.invalid);
      return;
    }
    const dest = result.dest;
    // A direct username/password login into a demo account (e.g. typing
    // "demo_student_10_01" instead of using the Demo Mode button) should
    // still get the welcome modal + banner — same flag the DemoRoleModal sets.
    if (result.isDemo) {
      sessionStorage.setItem("show-demo-welcome", "true");
    }
    // `loading` stays true straight through the navigation below (it's only
    // ever reset to false on the error path above) — the button never goes
    // idle between "auth succeeded" and "new page is actually on screen".
    // isPending (true for the duration of the transition) switches the
    // button label to a distinct "entering" phase so the two waits read
    // differently, and prevents React from painting the old page as stale.
    startTransition(() => {
      router.replace(dest);
      router.refresh();
    });
  }

  return (
    <div className="relative z-30 flex w-full max-w-md flex-col items-center">
      {/* Промт 6.2.3: логотип вынесен ИЗ карточки — стоит отдельно, крупно,
          по центру, над карточкой. mb-10 (40px) — отступ до карточки;
          h-[76px] → ширина ≈226px (диапазон 200-240px по аспекту логотипа
          849:285). Квадратик со значком шапочки убран 18.08.2026: он ничего
          не сообщал, а держал над содержимым пустую полосу.
          lg:hidden — на lg+ уже виден большой логотип в BrandingColumn
          (page.tsx: тот же breakpoint, "hidden ... lg:flex"); без этого
          на широком экране показывались оба логотипа одновременно. */}
      <Logo priority className="mb-10 h-[76px] lg:hidden" />

      <div
        className="relative w-full overflow-hidden rounded-[2rem] border border-white/40 bg-white/70 backdrop-blur-xl"
        style={{ boxShadow: "0 20px 60px -15px rgba(0,0,0,0.15)" }}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/30 blur-3xl" />

        {/* Промт 6.2: раньше carta была capped на calc(100vh-8rem) и обрезала
            контент на планшете 768 — теперь высота card естественная,
            скроллится вся страница (page.tsx: min-h-screen). */}
        <div className="p-6 [@media(max-height:760px)]:p-4">
          {/* Школа — крупно и по центру: логотип, под ним название. Раньше это
              была мелкая строка сбоку, и человек, за которого выбор подставился
              из памяти браузера, её просто не замечал. Заголовок при этом
              уходит: две крупные надписи подряд спорят друг с другом, а
              «в какую школу вхожу» важнее, чем «это экран входа». */}
          {/* ТРИ СОСТОЯНИЯ ШАПКИ, И НИ ОДНО НЕ ПОДМЕНЯЕТ ДРУГОЕ ПО СМЫСЛУ.

              19.08.2026 — было два: «школа известна» и «заголовок». Второе
              доставалось и тому, про кого просто ещё не выяснили школу, — и
              человек видел «Вход в кабинет», который через секунду с лишним
              превращался в логотип его школы. Кадр менял смысл на глазах.

              Теперь незнание отделено от отсутствия:

              picked.school — школа известна. Логотип, название, «Сменить
              школу». При одной школе в установке это состояние приезжает уже
              в HTML, то есть человек видит его первым кадром.

              picked === null — ЕЩЁ НЕ ЗНАЕМ (школ несколько, а какую помнит
              этот браузер, серверу неизвестно: HTML один на всех и лежит в
              кэше). Занимаем ровно то место, которое займёт школа: рамка под
              логотип, полоса под название, пустая строка под ссылку. Никакого
              текста — сказать пока нечего, а обещать «просто вход» нельзя.
              Через мгновение место заполнится, и ничего не сдвинется.

              picked.school === null — школы НЕТ (ни одной в установке, либо
              список не открылся). Вот здесь заголовок уместен: показывать
              нечего и не будет.

              Высоты всех трёх совпадают — проверено замером, карточка не
              прыгает ни при каком переходе. */}
          {picked === null ? (
            <div
              aria-hidden
              className="mb-5 [@media(max-height:760px)]:mb-3 flex flex-col items-center pt-1"
            >
              {/* Размеры повторяют SchoolMark size="xl" и строку названия
                  один в один — иначе появление школы сдвинуло бы форму. */}
              <div className="h-20 w-20 animate-pulse rounded-3xl bg-slate-200/70" />
              <div className="mt-3 h-[22.5px] w-44 animate-pulse rounded-md bg-slate-200/70" />
              <div className="mt-1 h-4" />
            </div>
          ) : picked.school ? (
            <div className="mb-5 [@media(max-height:760px)]:mb-3 flex flex-col items-center pt-1 text-center">
              <SchoolMark name={picked.school.name} logoUrl={picked.school.logoUrl} size="xl" />
              <p className="mt-3 text-lg font-bold leading-tight text-slate-900">{picked.school.name}</p>
              <button
                type="button"
                onClick={() => { setReopenPicker(true); setError(null); setSchoolChoices(null); }}
                className="mt-1 text-xs font-medium text-slate-500 underline hover:text-slate-700"
              >
                {t.chooseSchoolChange}
              </button>
            </div>
          ) : (
            <h1 className="mb-4 [@media(max-height:760px)]:mb-2 text-2xl font-bold leading-tight tracking-tight text-slate-900">
              {t.title}
            </h1>
          )}

          {/* Окно выбора школы. Открыто, пока школа не выбрана, — и повторно
              по «Сменить школу».

              Если школ не окажется или список не откроется, окно само позовёт
              onSkip, и форма появится немедленно: вход не должен зависеть от
              нового шага. Единственная школа подставляется без окна — выбирать
              из одной плитки нечего. */}
          {(picked === null || reopenPicker) && (
            <SchoolPickerModal
              locale={locale}
              initialSchools={initialSchools}
              reopened={reopenPicker}
              onPick={(school) => { setPicked({ school }); setReopenPicker(false); }}
              onSkip={() => { setPicked({ school: null }); setReopenPicker(false); }}
              onClose={() => setReopenPicker(false)}
            />
          )}

          {/* 18.08.2026 — КАРТОЧКА БОЛЬШЕ НЕ ЖДЁТ СПИСОК ШКОЛ.
              Было: пока список не пришёл, здесь стояла одна строка «Загружаем
              список школ…», и карточка держалась маленькой. Замер в браузере:
              страница готова за 335 мс, шрифты за 151 мс, а запрос списка школ
              длился 3510 мс — всё это время человек смотрел на узкую карточку,
              которая потом разом становилась формой. Выглядело как «грузится
              шесть секунд и раскрывается», хотя анимации нет вовсе
              (transition-duration 0s — проверено).
              Стало: форма рисуется сразу и в полный размер, а школа
              подставляется в шапку, когда приедет. Ждать её незачем — школа
              нужна только в момент отправки, а не для показа полей. */}
          {schoolChoices ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-700">{t.pickSchoolTitle}</p>
              {schoolChoices.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onPickSchool(sc.id)}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  {sc.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSchoolChoices(null); setError(null); }}
                className="text-xs text-slate-500 underline"
              >
                {t.backBtn}
              </button>
              {error && (
                <p className="text-sm font-medium text-red-600">{error}</p>
              )}
            </div>
          ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 [@media(max-height:760px)]:gap-2">
            {/* Логин */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{t.usernameLabel}</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  autoCapitalize="none"
                  autoComplete="username"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 py-2.5 pl-11 pr-3 text-sm text-slate-900 placeholder-slate-500 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#FF8A45]"
                />
              </div>
            </div>

            {/* Пароль */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{t.passwordLabel}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 py-2.5 pl-11 pr-10 text-sm text-slate-900 placeholder-slate-500 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#FF8A45]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  className="absolute right-0 top-0 flex h-full items-center px-3 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Запомнить меня */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember-me"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 bg-white/50 text-[#FFC145] focus:ring-[#FFC145]"
              />
              <label htmlFor="remember-me" className="ml-2 cursor-pointer select-none text-sm font-medium text-slate-700">
                {t.rememberMe}
              </label>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              // Пока школа не выбрана, отправлять нечего: форма видна, но
              // кнопка ждёт. Это честнее, чем прятать всю форму.
              disabled={loading || isPending || picked === null}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-transparent bg-gradient-to-r from-[#FFC145] to-[#FF6B6B] px-4 py-3 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isPending ? t.enteringApp : loading ? t.signingIn : (
                  <>
                    {t.submit}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                  </>
                )}
              </span>
            </button>
          </form>
          )}

          {/* «Забыли пароль» на шаге выбора школы не показываем: человек ещё
              не сказал, кто он, и восстанавливать нечего. Ряд ниже — демо и
              OAuth — остаётся на месте всегда: демо это отдельная дверь, и
              она работает ровно как работала.

              19.08.2026 — НЕ ПОКАЗЫВАЕМ, НО МЕСТО ДЕРЖИМ. Раньше блок просто не
              рисовался, и когда школа подставлялась, карточка подрастала на
              31 пиксель — замерено. Прыжок приходился ровно туда, куда человек
              смотрит, и читался как вторая перерисовка экрана. visibility
              вместо снятия с разметки: кнопка так же недоступна и невидима, но
              высота занята с первого кадра. */}
          <div className={`mt-3 [@media(max-height:760px)]:mt-1.5 text-center${picked === null ? " invisible" : ""}`}>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-700"
            >
              {t.forgot}
            </button>
          </div>

          <div className="my-4 [@media(max-height:760px)]:my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/40" />
            <span className="text-xs font-medium text-slate-600">{t.orLoginWith}</span>
            <div className="h-px flex-1 bg-white/40" />
          </div>

          {/* P2-фикс (revert бага А): вернули ОДНУ кнопку «Демо» (расположение —
              как до пачки 2, первая ячейка OAuth-ряда). Открывает DemoRoleModal
              с 6 карточками (1 ученик + 5 предметников). */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              title={d.demoMode.buttonLabel}
              className="group flex items-center justify-center gap-1 rounded-xl border border-white/80 bg-white/70 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow-md"
            >
              <Sparkles className="h-4 w-4 text-violet-500 group-hover:text-violet-600" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                {d.demoMode.shortLabel}
              </span>
            </button>
            {/* Вход через Google — рабочий для учеников, учителей,
                администраторов и родителей: почту вписывает администратор, и
                она сверяется на возврате. */}
            <button
              type="button"
              onClick={onGoogle}
              disabled={googleBusy}
              title={t.withGoogle}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            >
              <GoogleIcon />
            </button>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white"
            >
              <Image src="/oauth/oneid.jpg" alt="OneID" width={32} height={32} className="h-6 w-6 object-contain" />
            </button>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white"
            >
              <MicrosoftIcon />
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm">
            {notice}
          </div>
        </div>
      )}

      {showDemoModal && <DemoRoleModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
}
