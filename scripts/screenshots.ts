/**
 * SNR EduOS — автоматический обход страниц и fullpage-скриншоты.
 * Утилитарный скрипт, не production-код.
 *
 * Запуск (из корня репозитория):
 *   pnpm exec tsx scripts/screenshots.ts
 *
 * Требования (устанавливаются один раз):
 *   pnpm add -Dw playwright tsx
 *   pnpm exec playwright install chromium
 */

import { chromium, type Page, type BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

// ── Настройки ────────────────────────────────────────────────────────────────

const BASE_URL = "https://snr-edu-os-web.vercel.app";
const OUT_DIR   = path.join(process.cwd(), "screenshots");
const VIEWPORT  = { width: 1440, height: 900 };

// Все три роли используют одну форму: поле «username» (не email),
// signInWithUsername сам пробует домены students → teachers → admins.
const CREDS = {
  student: { username: "Adilbek_07",    password: "password123" },
  teacher: { username: "teacher_ivan",  password: "password123" },
  // Если admin-пользователь создан через Supabase Dashboard,
  // его username — часть email до @: admin@admins.snr.local → "admin".
  // Если admin не создан — секция admin будет пропущена (caught per-page).
  admin:   { username: "admin",         password: "admin123"    },
};

// ── Список страниц ───────────────────────────────────────────────────────────

type PageEntry = {
  role: "student" | "teacher" | "admin";
  name: string;
  url: string;
  /** true = снять ДО логина (сама страница /login) */
  beforeLogin?: boolean;
};

const PAGES: PageEntry[] = [
  // ── УЧЕНИК ──────────────────────────────────────────────────────────────
  { role: "student", name: "01-login",              url: "/login",              beforeLogin: true },
  { role: "student", name: "02-student-dashboard",  url: "/dashboard" },
  { role: "student", name: "03-student-schedule",   url: "/schedule" },
  { role: "student", name: "04-student-homework",   url: "/homework" },
  { role: "student", name: "05-student-grades",     url: "/grades" },
  { role: "student", name: "06-student-attendance", url: "/attendance" },
  { role: "student", name: "07-student-materials",  url: "/materials" },
  { role: "student", name: "08-student-books",      url: "/books" },
  { role: "student", name: "09-student-projects",   url: "/projects" },
  { role: "student", name: "10-student-notifications", url: "/notifications" },
  { role: "student", name: "11-student-announcements", url: "/announcements" },
  { role: "student", name: "12-student-profile",    url: "/profile" },

  // ── УЧИТЕЛЬ ─────────────────────────────────────────────────────────────
  { role: "teacher", name: "13-teacher-dashboard",    url: "/teacher/dashboard" },
  { role: "teacher", name: "14-teacher-lessons",      url: "/teacher/lessons" },
  { role: "teacher", name: "15-teacher-homework",     url: "/teacher/homework" },
  { role: "teacher", name: "16-teacher-grades",       url: "/teacher/grades" },
  { role: "teacher", name: "17-teacher-attendance",   url: "/teacher/attendance" },
  { role: "teacher", name: "18-teacher-projects",     url: "/teacher/projects" },
  { role: "teacher", name: "19-teacher-materials",    url: "/teacher/materials" },
  { role: "teacher", name: "20-teacher-books",        url: "/teacher/books" },
  { role: "teacher", name: "21-teacher-groups",       url: "/teacher/groups" },
  { role: "teacher", name: "22-teacher-announcements",url: "/teacher/announcements" },
  { role: "teacher", name: "23-teacher-notifications",url: "/teacher/notifications" },
  { role: "teacher", name: "24-teacher-settings",     url: "/teacher/settings" },

  // ── АДМИН ────────────────────────────────────────────────────────────────
  // Требует: создать auth-пользователя admin@admins.snr.local в Supabase Dashboard
  // + INSERT INTO public.admins. Если не создан — эти страницы упадут, остальные ОК.
  { role: "admin", name: "25-admin-dashboard",     url: "/admin" },
  { role: "admin", name: "26-admin-students",      url: "/admin/students" },
  { role: "admin", name: "27-admin-teachers",      url: "/admin/teachers" },
  { role: "admin", name: "28-admin-groups",        url: "/admin/groups" },
  { role: "admin", name: "29-admin-announcements", url: "/admin/announcements" },
];

// ── Хелперы ──────────────────────────────────────────────────────────────────

/** Логинится в новом контексте и возвращает авторизованную страницу. */
async function loginAs(
  context: BrowserContext,
  role: "student" | "teacher" | "admin",
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });

  // Форма LoginForm.tsx:
  //   <input autocomplete="username" ...>     — поле логина
  //   <input autocomplete="current-password"> — поле пароля
  //   <button type="submit">                  — кнопка «Войти»
  const { username, password } = CREDS[role];
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Ждём редиректа с /login
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  return page;
}

/** Снимает fullpage-скриншот. */
async function shot(page: Page, name: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Небольшая пауза: анимации Tailwind, lazy-load карточек
  await page.waitForTimeout(1_500);

  // Прячем нативные скроллбары чтобы не попадали в скриншот
  await page.addStyleTag({
    content: `::-webkit-scrollbar{display:none!important}*{scrollbar-width:none!important}`,
  });

  const filepath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true, animations: "disabled" });
  console.log(`  ✓  ${name}.png`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nSNR EduOS screenshots → ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const t0 = Date.now();
  let ok = 0;
  let fail = 0;

  try {
    const roles: Array<"student" | "teacher" | "admin"> = ["student", "teacher", "admin"];

    for (const role of roles) {
      console.log(`\n── ${role.toUpperCase()} ──────────────────────────────`);
      const context = await browser.newContext({ viewport: VIEWPORT });

      try {
        // Страница логина (только один раз, под student, без авторизации)
        if (role === "student") {
          const prePage = await context.newPage();
          await prePage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
          await shot(prePage, "01-login");
          await prePage.close();
        }

        // Логин
        const page = await loginAs(context, role);

        // Обходим страницы этой роли
        const rolePages = PAGES.filter((p) => p.role === role && !p.beforeLogin);
        for (const entry of rolePages) {
          try {
            await page.goto(`${BASE_URL}${entry.url}`, {
              waitUntil: "networkidle",
              timeout: 30_000,
            });
            await shot(page, entry.name);
            ok++;
          } catch (err) {
            console.error(`  ✗  ${entry.name} — ${(err as Error).message.split("\n")[0]}`);
            fail++;
          }
        }
      } catch (loginErr) {
        console.error(
          `  ✗  Login as ${role} failed — ${(loginErr as Error).message.split("\n")[0]}`,
        );
        fail += PAGES.filter((p) => p.role === role && !p.beforeLogin).length;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const total = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".png")).length;
  console.log(`\n── Готово ────────────────────────────────────────`);
  console.log(`   Успешно: ${ok + 1}  Ошибки: ${fail}`); // +1 = login page
  console.log(`   Файлов в папке: ${total}`);
  console.log(`   Время: ${elapsed}s`);
  console.log(`   Папка: ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
