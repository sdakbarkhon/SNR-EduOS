import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { signLogoUrl } from "@/lib/school-card";

// Список школ ДО входа — для первого экрана входа.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ ПУТЬ. До входа сессии нет, а правила доступа на schools
// отдают вошедшему ровно одну строку — его собственную школу
// («authenticated reads own school»). Анонимному посетителю они не отдают
// ничего, и это правильно: список школ — не то, что должно быть открыто
// «просто так». Поэтому здесь один узкий маршрут, который отдаёт РОВНО три
// поля и ничего больше.
//
// ЧТО УХОДИТ НАРУЖУ: id, название, ссылка на логотип. Всё.
// Чего НЕ уходит и уйти не может — здесь это не «забыли», а перечислено
// осознанно: код школы, реквизиты, адрес, телефон, почта, ФИО директора,
// сайт, автостарт, ночное закрытие, замороженная дата, признак демо, признак
// архива, дата создания, число учеников. Выборка перечисляет колонки поимённо
// (не select("*")), а ответ собирается вручную полем к полю — чтобы новая
// колонка в schools не начала утекать сама собой при следующей миграции.
//
// ПОЧЕМУ ЭТО НЕ ЗАЩИТА, А УДОБСТВО. Выбор школы на входе не разграничивает
// доступ и не может: что человек увидит после входа, решают правила доступа
// по ЕГО школе, а не по тому, что он выбрал на первом экране. Выбор нужен,
// чтобы человек попал в свою школу с первого раза и увидел её логотип, и
// чтобы одинаковые логины в разных школах не спрашивались вторым вопросом.
//
// АРХИВНЫЕ И ДЕМО не отдаются: архивная школа входа не имеет вовсе
// (миграция 202), а демо — витрина с собственной кнопкой на том же экране,
// и в списке школ, куда человек «относится», ей не место.

export const dynamic = "force-dynamic";

type PublicSchool = { id: string; name: string; logoUrl: string | null };

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[public/schools] нет ключей Supabase");
    // Пустой список, а не 500: экран входа обязан открыться в любом случае.
    // Как он поступает с пустым списком — см. SchoolPicker: пропускает шаг.
    return NextResponse.json({ schools: [] as PublicSchool[] });
  }

  const sb = createSbClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from("schools")
    .select("id, name, logo_path")
    .eq("is_active", true)
    .eq("is_demo", false)
    .order("name");

  if (error) {
    console.error("[public/schools] не удалось прочитать список:", error.message);
    return NextResponse.json({ schools: [] as PublicSchool[] });
  }

  const rows = (data ?? []) as Array<{ id: string; name: string; logo_path: string | null }>;

  // Ответ собирается вручную: сюда попадает только то, что перечислено.
  const schools: PublicSchool[] = await Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      name: s.name,
      logoUrl: await signLogoUrl(s.logo_path),
    })),
  );

  // Пять минут кэша. Ссылка на логотип подписана на час, так что за время
  // жизни кэша протухнуть не успеет.
  return NextResponse.json({ schools }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
