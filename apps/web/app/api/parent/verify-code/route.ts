import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifyParentCode } from "@/lib/parent-sms";
import { clientIp, rateLimit, retryHeaders } from "@/lib/rate-limit";

/**
 * Проверка кода входа родителя для мобильного приложения.
 *
 * ЧТО ВОЗВРАЩАЕТ И ПОЧЕМУ ИМЕННО ЭТО. Не сессию и не пароль, а одноразовый
 * `token_hash` магической ссылки. Приложение меняет его на сессию само —
 * `supabase.auth.verifyOtp` на устройстве, — и токены сразу оказываются в
 * защищённом хранилище приложения, под тем же клиентом, которым потом ходят
 * все экраны. Если бы сервер отдавал готовую пару токенов, их пришлось бы
 * вручную вкладывать в клиент, а refresh перестал бы принадлежать SDK.
 *
 * Пароль родителя здесь не участвует вовсе: он задаётся админом, серверу
 * неизвестен (в базе хеш) и нужен только как запасной путь. Владение
 * телефоном подтверждает код.
 *
 * Токен одноразовый и живёт минуты; уходит он на устройство, которое только
 * что доказало владение номером, по HTTPS.
 *
 * Тот же приём, что в app/actions/parentPhoneAuth.ts для веба, — разница
 * только в том, кто обменивает токен на сессию: там сервер, здесь само
 * приложение.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ЧАСТОТА: 120 обращений с одного адреса в час (миграция 219).
 *
 * ВДВОЕ БОЛЬШЕ, ЧЕМ У ВЫДАЧИ КОДА, И ЭТО НЕ ЩЕДРОСТЬ, А АРИФМЕТИКА. У
 * действующего кода пять попыток: человек может ошибиться цифрой, попросить
 * новый код и ошибиться снова — и всё это в пределах одного честного входа.
 * На один запрос кода приходится в среднем полтора-два обращения сюда,
 * поэтому порог и вдвое больше. За одним адресом при этом сидит целый
 * оператор, а не один человек.
 *
 * Лимит попыток на сам код не меняется, он живёт отдельно в verifyParentCode
 * и считается по коду, а не по адресу.
 *
 * Отказ отдаётся кодом too_soon: приложение знает закрытый список кодов, и
 * новый оно показало бы как «нет сети».
 */
const ПОРОГ = 120;
const ОКНО_С = 3600;

export async function POST(req: NextRequest) {
  const частота = await rateLimit(clientIp(req.headers), "parent_verify_code", ПОРОГ, ОКНО_С);
  if (!частота.allowed) {
    return NextResponse.json({ error: "too_soon" }, { status: 429, headers: retryHeaders(частота) });
  }

  const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
  const phone = String(body?.phone ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!phone || !code) return NextResponse.json({ error: "phone and code required" }, { status: 400 });

  const verified = await verifyParentCode(phone, code);
  if (!verified.ok) {
    const status = verified.error === "failed" ? 500 : 400;
    // attemptsLeft приходит только с wrong_code — приложение показывает его
    // человеку, чтобы пятая попытка не оказалась неожиданностью.
    return NextResponse.json(
      { error: verified.error, ...(verified.attemptsLeft != null ? { attemptsLeft: verified.attemptsLeft } : {}) },
      { status },
    );
  }
  if (!verified.userId) {
    // Родитель заведён до Z.2.8 и учётной записи не имеет. Сам он это не
    // починит — нужен админ, поэтому причина отдаётся отдельной.
    return NextResponse.json({ error: "no_account" }, { status: 409 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "failed" }, { status: 500 });
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });

  const { data: authUser } = await admin.auth.admin.getUserById(verified.userId);
  const email = authUser?.user?.email;
  if (!email) return NextResponse.json({ error: "no_account" }, { status: 409 });

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink", email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true, tokenHash });
}
