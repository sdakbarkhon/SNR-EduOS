import { NextRequest, NextResponse } from "next/server";
import { issueParentCode } from "@/lib/parent-sms";

/**
 * Запрос кода входа родителя. Неавторизованный маршрут — его зовут ДО входа.
 *
 * Существует ради мобильного приложения: server actions Next.js из React
 * Native недоступны, а веб-форма родителя ходит прямо в
 * app/actions/parentPhoneAuth.ts. Логика не дублируется — оба пути зовут одну
 * и ту же issueParentCode (apps/web/lib/parent-sms.ts), где живут срок жизни
 * кода, лимит попыток и защита от частых запросов.
 *
 * Перебор номеров этим маршрутом не злоупотребишь: код всё равно уходит
 * только на настоящий телефон, а частота ограничена одним кодом в минуту на
 * номер.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = String(body?.phone ?? "").trim();
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  // deferSms: приложение не ждёт провайдера. Код уже записан, экран ввода
  // открывается сразу, отправка доигрывается после ответа.
  const result = await issueParentCode(phone, { deferSms: true });
  if (!result.ok) {
    // 404 на неизвестный номер намеренно: родителей заводит админ, это не
    // публичная регистрация, и «код отправлен» на чужой номер запутал бы
    // того, кто просто ошибся цифрой.
    const status = result.error === "not_found" ? 404 : result.error === "too_soon" ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, delivered: result.delivered });
}
