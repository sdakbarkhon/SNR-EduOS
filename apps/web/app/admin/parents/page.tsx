import { createClient } from "@/lib/supabase/server";
import { ParentsView } from "./ParentsView";

export default async function AdminParentsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: parents }, { data: links }, { data: invites }, { data: allStudents }] = await Promise.all([
    sb.from("parents").select("id, full_name, phone, user_id, created_at").order("full_name"),
    sb.from("parent_students").select("parent_id, student_id"),
    sb.from("parent_invites").select("id, parent_id, code, expires_at, used_at, created_at").order("created_at", { ascending: false }),
    sb.from("students").select("id, full_name, username").order("full_name"),
  ]);

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
  for (const l of linkRows) {
    const arr = childrenByParent.get(l.parent_id) ?? [];
    arr.push(studentMap.get(l.student_id) ?? "?");
    childrenByParent.set(l.parent_id, arr);
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
      full_name: p.full_name,
      phone: p.phone,
      isRegistered: !!p.user_id,
      created_at: p.created_at,
      children: childrenByParent.get(p.id) ?? [],
      inviteCode: invite?.code ?? null,
      inviteExpired: invite ? new Date(invite.expires_at).getTime() < Date.now() : true,
    };
  });

  return <ParentsView parents={rows} allStudents={studentRows} />;
}
