import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUEUE_MAX_ATTEMPTS } from "@/lib/ai/process-embedding-queue";
import { AdminRagView } from "./AdminRagView";

// Числа должны быть свежими на каждый заход: очередь меняется от правок
// учителей, а не раз в сутки.
export const dynamic = "force-dynamic";

/**
 * Материалы для помощника ИИ: сколько этапов ждёт отпечатка текста и кнопка
 * посчитать их сейчас.
 *
 * ЗАЧЕМ ЭКРАН. Разгребатель очереди (/api/admin/rag/process-batch) написан
 * ещё в Пачке 5.1 и с тех пор не имел ни одного вызывающего: дёрнуть его
 * можно было только запросом снаружи, руками. Крон, который делал это по
 * расписанию, снят 08.08.2026 вместе с четырьмя другими — бесплатный тариф
 * даёт два. Пока разбора не было, очередь росла: к 22.08 в ней лежала 291
 * запись, и помощник отвечал ученикам по устаревшему тексту.
 *
 * ПОЧЕМУ СЛУЖЕБНЫЙ КЛЮЧ ДЛЯ ЧИСЕЛ. У обеих таблиц миграции 139 нет ни одного
 * правила доступа и нет прав у роли authenticated: читать их сессией
 * администратора нечем. Поэтому счётчики берутся служебным ключом, и оба
 * запроса ЯВНО ограничены школой администратора — она резолвится строкой из
 * admins, как в /api/admin/chats.
 */
export default async function AdminRagPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Каркас /admin (layout.tsx) сюда без строки в admins не пускает — он
  // отправляет на вход. Здесь нужна только школа.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (supabase as any)
    .from("admins")
    .select("school_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const schoolId: string | null = admin?.school_id ?? null;

  let queued = 0;
  let stuck = 0;
  let indexed = 0;

  if (schoolId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const [q, s, i] = await Promise.all([
      db.from("lesson_stages_embedding_queue")
        .select("*", { count: "exact", head: true })
        .lt("attempts", QUEUE_MAX_ATTEMPTS)
        .eq("school_id", schoolId),
      db.from("lesson_stages_embedding_queue")
        .select("*", { count: "exact", head: true })
        .gte("attempts", QUEUE_MAX_ATTEMPTS)
        .eq("school_id", schoolId),
      db.from("lesson_stage_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ]);
    queued = q.count ?? 0;
    stuck = s.count ?? 0;
    indexed = i.count ?? 0;
  }

  return <AdminRagView queued={queued} stuck={stuck} indexed={indexed} />;
}
