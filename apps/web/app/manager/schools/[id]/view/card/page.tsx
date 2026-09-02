import { schoolViewContext } from "@/lib/school-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManagerCardView } from "./ManagerCardView";

/**
 * Карточка школы, правимая менеджером. Заход 3.
 *
 * Проверка и школа — тем же schoolViewContext, что и все десять экранов
 * просмотра: он же отсекает демо-школу и чужого. Отдельной проверки здесь не
 * заводим — второй копии правила быть не должно.
 *
 * Суперадмина сюда не пускаем: у него своё окно правки школы, где к карточке
 * добавлены имя, код, автостарт и длительность урока. Два окна на одно и то
 * же — это два места, которые однажды разойдутся.
 */
export const dynamic = "force-dynamic";

export default async function ManagerSchoolCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { school, actor } = await schoolViewContext(id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createAdminClient() as any)
    .from("schools")
    .select("address, phone, email, director_name, website, legal_details")
    .eq("id", school.id)
    .maybeSingle();

  return (
    <ManagerCardView
      schoolId={school.id}
      schoolName={school.name}
      readOnly={actor.role !== "manager"}
      card={{
        address: (data?.address as string | null) ?? null,
        phone: (data?.phone as string | null) ?? null,
        email: (data?.email as string | null) ?? null,
        director_name: (data?.director_name as string | null) ?? null,
        website: (data?.website as string | null) ?? null,
        legal_details: (data?.legal_details as string | null) ?? null,
      }}
    />
  );
}
