import { createClient } from "@/lib/supabase/server";
import { getMySchoolNowMs } from "@/lib/school-time-server";
import { ParentsView } from "./ParentsView";

export default async function AdminParentsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Z.3, заход 2 — «истекло ли приглашение» считается от времени школы админа.
  // Это единственное место в админке, зависящее от даты, и оно же — первый
  // экран, которым пользуется админ НАСТОЯЩЕЙ школы: под замороженным 29.07
  // все его приглашения выглядели бы просроченными или, наоборот, вечными.
  const nowMs = await getMySchoolNowMs(supabase);

  const [
    { data: parents, error: parentsError },
    { data: links, error: linksError },
    { data: invites, error: invitesError },
    { data: allStudents, error: studentsError },
  ] = await Promise.all([
    sb.from("parents").select("id, full_name, phone, user_id, created_at").order("full_name"),
    sb.from("parent_students").select("parent_id, student_id"),
    sb.from("parent_invites").select("id, parent_id, code, expires_at, used_at, created_at").order("created_at", { ascending: false }),
    sb.from("students").select("id, full_name, username").order("full_name"),
  ]);
  if (parentsError) console.error("[AdminParentsPage] parents query failed:", parentsError.message);
  if (linksError) console.error("[AdminParentsPage] parent_students query failed:", linksError.message);
  if (invitesError) console.error("[AdminParentsPage] parent_invites query failed:", invitesError.message);
  if (studentsError) console.error("[AdminParentsPage] students query failed:", studentsError.message);

  type ParentRow = { id: string; full_name: string; phone: string | null; user_id: string | null; created_at: string };
  type LinkRow = { parent_id: string; student_id: string };
  type InviteRow = { id: string; parent_id: string; code: string; expires_at: string; used_at: string | null; created_at: string };
  type StudentRow = { id: string; full_name: string; username: string };

  const parentRows = (parents ?? []) as ParentRow[];
  const linkRows = (links ?? []) as LinkRow[];
  const inviteRows = (invites ?? []) as InviteRow[];
  const studentRows = (allStudents ?? []) as StudentRow[];

  const studentMap = new Map(studentRows.map((s) => [s.id, s.full_name]));

  const childrenByParent = new Map<string, string[]>();
  const childIdsByParent = new Map<string, string[]>();
  for (const l of linkRows) {
    const arr = childrenByParent.get(l.parent_id) ?? [];
    arr.push(studentMap.get(l.student_id) ?? "?");
    childrenByParent.set(l.parent_id, arr);

    const idArr = childIdsByParent.get(l.parent_id) ?? [];
    idArr.push(l.student_id);
    childIdsByParent.set(l.parent_id, idArr);
  }

  // inviteRows is already ordered by created_at desc, so the first match per
  // parent_id encountered here is the most recent invite for that parent.
  const latestInviteByParent = new Map<string, InviteRow>();
  for (const inv of inviteRows) {
    if (!latestInviteByParent.has(inv.parent_id)) latestInviteByParent.set(inv.parent_id, inv);
  }

  const rows = parentRows.map((p) => {
    const invite = latestInviteByParent.get(p.id);
    return {
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      isRegistered: !!p.user_id,
      created_at: p.created_at,
      children: childrenByParent.get(p.id) ?? [],
      childIds: childIdsByParent.get(p.id) ?? [],
      inviteCode: invite?.code ?? null,
      inviteExpired: invite ? new Date(invite.expires_at).getTime() < nowMs : true,
    };
  });

  return <ParentsView parents={rows} allStudents={studentRows} />;
}
