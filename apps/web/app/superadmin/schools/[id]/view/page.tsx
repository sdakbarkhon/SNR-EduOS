import { schoolViewContext } from "@/lib/school-view";
import { OverviewClient } from "./OverviewClient";

export const dynamic = "force-dynamic";

/** Обзор школы: сколько чего и карточка организации. */
export default async function SchoolOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, school } = await schoolViewContext(id);

  const счёт = async (table: string) => {
    const { count } = await db.from(table).select("id", { count: "exact", head: true })
      .eq("school_id", school.id);
    return count ?? 0;
  };

  const [students, teachers, groups, parents, subjects, lessons, announcements] = await Promise.all([
    счёт("students"), счёт("teachers"), счёт("groups"), счёт("parents"),
    счёт("school_subjects"), счёт("lessons"), счёт("announcements"),
  ]);

  const { data: card } = await db
    .from("schools")
    .select("address, phone, email, director_name, website, legal_details")
    .eq("id", school.id).maybeSingle();

  return (
    <OverviewClient
      stats={[
        { labelKey: "svCountStudents", value: students },
        { labelKey: "svCountTeachers", value: teachers },
        { labelKey: "svCountGroups", value: groups },
        { labelKey: "svCountParents", value: parents },
        { labelKey: "svCountSubjects", value: subjects },
        { labelKey: "svCountLessons", value: lessons },
        { labelKey: "svCountAnnouncements", value: announcements },
      ]}
      card={[
        { labelKey: "svCardCode", value: school.code },
        { labelKey: "svCardAddress", value: card?.address ?? null },
        { labelKey: "svCardPhone", value: card?.phone ?? null },
        { labelKey: "svCardEmail", value: card?.email ?? null },
        { labelKey: "svCardDirector", value: card?.director_name ?? null },
        { labelKey: "svCardWebsite", value: card?.website ?? null },
        { labelKey: "svCardLegal", value: card?.legal_details ?? null },
      ]}
    />
  );
}
