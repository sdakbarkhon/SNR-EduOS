import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminChatsView } from "./AdminChatsView";

export default async function AdminChatsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: teachers }, { data: groups }, { data: adminRow }] = await Promise.all([
    sb.from("teachers").select("id, full_name").order("full_name"),
    sb.from("groups").select("id, name").order("name"),
    user ? sb.from("admins").select("school_id").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Счётчики по категориям — нужны, чтобы дропдаун "Тип чата" динамически
  // прятал категории с 0 чатов (Пачка 7.20-2, ЧАСТЬ 3). chat_threads —
  // обычный cookie-клиент (RLS после миграции 142 пускает admin'а на весь
  // kind в своей школе); ai_chat_messages — service-role, как и в самих
  // роутах списка/переписки.
  const schoolId: string | null = adminRow?.school_id ?? null;
  const adminDb = createAdminClient() as unknown as typeof sb;

  const [
    { count: teacherStudentCount },
    { count: parentTeacherCount },
    { count: classGroupCount },
    { count: lessonCount },
  ] = await Promise.all([
    sb.from("chat_threads").select("id", { count: "exact", head: true }).eq("kind", "direct").not("student_id", "is", null),
    sb.from("chat_threads").select("id", { count: "exact", head: true }).eq("kind", "direct").is("student_id", null),
    sb.from("chat_threads").select("id", { count: "exact", head: true }).eq("kind", "group"),
    schoolId
      ? adminDb.from("ai_chat_messages").select("id", { count: "exact", head: true }).eq("school_id", schoolId)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <AdminChatsView
      teachers={(teachers ?? []) as Array<{ id: string; full_name: string }>}
      groups={(groups ?? []) as Array<{ id: string; name: string }>}
      categoryCounts={{
        teacher_student: teacherStudentCount ?? 0,
        parent_teacher: parentTeacherCount ?? 0,
        class_group: classGroupCount ?? 0,
        lesson_ai_helper: lessonCount ?? 0,
      }}
    />
  );
}
