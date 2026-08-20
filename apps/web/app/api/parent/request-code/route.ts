import { NextRequest, NextResponse } from "next/server";
import { normalizeUzPhone } from "@snr/core";
import { issueParentCode } from "@/lib/parent-sms";
import { clientIp, rateLimit, retryHeaders } from "@/lib/rate-limit";

/**
 * Запрос кода входа родителя. Неавторизованный маршрут — его зовут ДО входа.
 *
 * Существует ради мобильного приложения: server actions Next.js из React
 * Native недоступны, а веб-форма родителя ходит прямо в
 * app/actions/parentPhoneAuth.ts. Логика не дублируется — оба пути зовут одну
 * и ту же issueParentCode (apps/web/lib/parent-sms.ts), где живут срок жизни
 * кода, лимит попыток и защита от частых запросов.
 *
 * ЧАСТОТА ОГРАНИЧЕНА ДВАЖДЫ, И ЭТО РАЗНЫЕ ОГРАНИЧЕНИЯ.
 *   • по номеру — один код в минуту, живёт в issueParentCode и не менялся;
 *   • по адресу — 20 обращений в час, миграция 219. Кулдаун по номеру от
 *     перебора ЧУЖИХ номеров не спасал вовсе: у несуществующего номера строк
 *     в parent_phone_codes нет никогда, значит и тормозить его было нечем.
 *
 * ПОЧЕМУ ПРИ ОТКАЗЕ ПО ЧАСТОТЕ УХОДИТ too_soon. Мобильное приложение знает
 * закрытый список кодов — not_found, too_soon, wrong_code, expired, too_many,
 * no_account — и любой другой показывает человеку как «нет сети»
 * (apps/mobile-parent/src/lib/parentPhoneLogin.ts). Заводить новый код значило
 * бы сломать экран, а по смыслу «слишком часто» здесь ровно то, что нужно.
 *
 * ПРО 60 В ЧАС. Первым числом было 20, и арифметика его не выдержала: школу
 * заводят целиком, и 25 родителей, входящих впервые с одного школьного
 * адреса, упирались бы впятером. Хуже школьного вайфая — сотовый оператор: в
 * Ташкенте за одним внешним адресом сидят тысячи абонентов Ucell или Beeline,
 * и двадцати первых входов в час на всего оператора хватило бы, чтобы
 * остальные получили отказ, сидя каждый у себя дома. Шестьдесят проходят оба
 * случая с запасом, а защиту не ослабляют: расход на SMS упирается не в этот
 * порог, а в кулдаун 60 секунд на номер, и перебор одинаково безнадёжен что
 * при 20, что при 60.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Обращений к выдаче кода с одного адреса в час. Держать в синхроне с
 *  app/actions/parentPhoneAuth.ts: веб-форма и этот маршрут делают одно и то
 *  же дело и считаются в ОДИН счётчик — см. там же, почему. */
const ПОРОГ = 60;
const ОКНО_С = 3600;

export async function POST(req: NextRequest) {
  const адрес = clientIp(req.headers);

  const частота = await rateLimit(адрес, "parent_request_code", ПОРОГ, ОКНО_С);
  if (!частота.allowed) {
    return NextResponse.json({ error: "too_soon" }, { status: 429, headers: retryHeaders(частота) });
  }

  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = String(body?.phone ?? "").trim();
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  // deferSms: приложение не ждёт провайдера. Код уже записан, экран ввода
  // открывается сразу, отправка доигрывается после ответа.
  const result = await issueParentCode(phone, { deferSms: true });

  if (!result.ok) {
    if (result.error === "not_found") {
      // ПОВТОРНЫЙ СТУК В НЕСУЩЕСТВУЮЩИЙ НОМЕР ОТВЕЧАЕТ КАК В НАСТОЯЩИЙ.
      //
      // У настоящего номера второй запрос за минуту упирается в кулдаун и
      // получает too_soon. У несуществующего кулдауну не за что зацепиться —
      // строки в parent_phone_codes не появляется, — и он отвечал not_found
      // хоть тысячу раз подряд. По этой разнице номера и перебирались.
      // Здесь тот же кулдаун считается в своей таблице: первый стук честно
      // отвечает «нет такого номера», повторный за минуту — too_soon, ровно
      // как у настоящего.
      const канон = normalizeUzPhone(phone);
      if (канон) {
        const повтор = await rateLimit(`phone:${канон}`, "parent_unknown_probe", 1, 60);
        if (!повтор.allowed) {
          return NextResponse.json({ error: "too_soon" }, { status: 429, headers: retryHeaders(повтор) });
        }
      }
      // 404 на неизвестный номер намеренно: родителей заводит админ, это не
      // публичная регистрация, и «код отправлен» на чужой номер запутал бы
      // того, кто просто ошибся цифрой.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const status = result.error === "too_soon" ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, delivered: result.delivered });
}
