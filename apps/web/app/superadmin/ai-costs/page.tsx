import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_TIER_DAILY_REQUESTS } from "@/lib/ai/config";
import { AiCostsView, type AiEventRow } from "./AiCostsView";

// Экран расходов на ИИ. Только суперадмин: это расходы всей установки, и
// школьному администратору они не адресованы. Право на чтение закрыто в базе
// (RLS-политика из миграции 209), здесь же данные читаются служебным ключом —
// как и на других экранах суперадмина, чтобы не зависеть от current_school_id().
//
// ПОЧЕМУ ВСЕ СТРОКИ СРАЗУ, А НЕ АГРЕГАТ В SQL. Фильтры (период, школа, вид
// задачи) и выгрузка должны работать мгновенно и вместе. Сводить в SQL пришлось
// бы отдельным запросом на каждое сочетание. Объём это позволяет: за всю
// историю проекта набралось 133 обращения, тысяча в сутки — бесплатный предел,
// то есть даже год работы на пределе даёт величину, которую браузер считает
// без запинки. Если счёт пойдёт на сотни тысяч — сводить придётся в базе, и
// это единственное место, которое тогда меняется.

export const dynamic = "force-dynamic";

export default async function AiCostsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [{ data: events }, { data: schools }, { data: legacy }] = await Promise.all([
    admin
      .from("ai_usage_events")
      .select("created_at, task, model, input_tokens, output_tokens, school_id, ok")
      .order("created_at", { ascending: false })
      .limit(50000),
    admin.from("schools").select("id, name, is_demo"),
    // Прежний счётчик обращений — отдельной строкой, чтобы июль и август не
    // выглядели как «месяцы без расходов».
    admin.from("ai_usage_log").select("day, requests_count").order("day", { ascending: true }),
  ]);

  const schoolNames: Record<string, string> = {};
  for (const s of (schools ?? []) as { id: string; name: string }[]) {
    schoolNames[s.id] = s.name;
  }

  const legacyRows = (legacy ?? []) as { day: string; requests_count: number }[];
  const legacyTotal = legacyRows.reduce((sum, r) => sum + (r.requests_count ?? 0), 0);
  const legacyFrom = legacyRows[0]?.day ?? null;
  const legacyTo = legacyRows[legacyRows.length - 1]?.day ?? null;

  // Остаток бесплатного предела на сегодня. Берётся из ТОГО ЖЕ счётчика, на
  // котором держится дневной лимит, а не из нового журнала: иначе число
  // разошлось бы с тем, по которому реально срабатывает ограничение.
  const { data: today } = await admin.rpc("get_ai_usage_today");
  const usedToday = typeof today === "number" ? today : 0;

  return (
    <AiCostsView
      events={(events ?? []) as AiEventRow[]}
      schoolNames={schoolNames}
      usedToday={usedToday}
      freeLimit={FREE_TIER_DAILY_REQUESTS}
      legacy={{ total: legacyTotal, from: legacyFrom, to: legacyTo }}
    />
  );
}
