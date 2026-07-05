import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role env vars not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function generatePassword(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── STUDENTS ─────────────────────────────────────────────────────────────────

export async function createStudent(data: {
  full_name: string;
  username: string;
  password: string;
  group_id: string;
  school_id: string;
}): Promise<{ userId: string; studentId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@students.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: student, error: stuErr } = await sb
    .from("students")
    .insert({ user_id: userId, full_name: data.full_name, username: data.username, school_id: data.school_id })
    .select("id")
    .single();
  if (stuErr || !student) {
    await sb.auth.admin.deleteUser(userId);
    throw stuErr ?? new Error("Student insert failed");
  }

  const { error: sgErr } = await sb
    .from("student_groups")
    .insert({ student_id: (student as { id: string }).id, group_id: data.group_id, school_id: data.school_id });
  if (sgErr) throw sgErr;

  return { userId, studentId: (student as { id: string }).id };
}

export async function updateStudent(
  studentId: string,
  userId: string,
  data: { full_name: string; username: string; group_id?: string; old_group_id?: string },
) {
  const sb = getServiceClient();
  const { error } = await sb
    .from("students")
    .update({ full_name: data.full_name, username: data.username })
    .eq("id", studentId);
  if (error) throw error;

  if (data.group_id && data.old_group_id && data.group_id !== data.old_group_id) {
    await sb.from("student_groups").delete().eq("student_id", studentId).eq("group_id", data.old_group_id);
    await sb.from("student_groups").insert({ student_id: studentId, group_id: data.group_id });
  }

  // Update email if username changed
  await sb.auth.admin.updateUserById(userId, {
    email: `${data.username.trim().toLowerCase()}@students.snr.local`,
  });
}

export async function resetStudentPassword(userId: string): Promise<string> {
  const sb = getServiceClient();
  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

export async function deleteStudent(userId: string) {
  const sb = getServiceClient();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// ── TEACHERS ─────────────────────────────────────────────────────────────────

export async function createTeacher(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
}): Promise<{ userId: string; teacherId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@teachers.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: teacher, error: tErr } = await sb
    .from("teachers")
    .insert({ user_id: userId, full_name: data.full_name, username: data.username, school_id: data.school_id })
    .select("id")
    .single();
  if (tErr || !teacher) {
    await sb.auth.admin.deleteUser(userId);
    throw tErr ?? new Error("Teacher insert failed");
  }

  return { userId, teacherId: (teacher as { id: string }).id };
}

export async function updateTeacher(
  teacherId: string,
  userId: string,
  data: { full_name: string; username: string },
) {
  const sb = getServiceClient();
  const { error } = await sb.from("teachers").update({ full_name: data.full_name, username: data.username }).eq("id", teacherId);
  if (error) throw error;
  await sb.auth.admin.updateUserById(userId, {
    email: `${data.username.trim().toLowerCase()}@teachers.snr.local`,
  });
}

export async function resetTeacherPassword(userId: string): Promise<string> {
  const sb = getServiceClient();
  const newPassword = generatePassword();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
  return newPassword;
}

export async function deleteTeacher(teacherId: string, userId: string) {
  const sb = getServiceClient();
  // Check if teacher has groups
  const { data: groups } = await sb.from("groups").select("id").eq("teacher_id", teacherId).limit(1);
  if (groups && groups.length > 0) throw new Error("BLOCKED: teacher has groups");
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

// ── GROUPS ────────────────────────────────────────────────────────────────────

export async function createGroup(data: {
  name: string;
  subject: string;
  teacher_id: string;
  school_id: string;
}): Promise<string> {
  const sb = getServiceClient();
  const { data: group, error } = await sb.from("groups").insert(data).select("id").single();
  if (error || !group) throw error ?? new Error("Group insert failed");
  return (group as { id: string }).id;
}

export async function updateGroup(
  groupId: string,
  data: { name: string; subject: string; teacher_id: string },
) {
  const sb = getServiceClient();
  const { error } = await sb.from("groups").update(data).eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const sb = getServiceClient();
  const { error } = await sb.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

// ── SUPER ADMIN: SCHOOL ADMINS ───────────────────────────────────────────────

export async function createSchoolAdmin(data: {
  full_name: string;
  username: string;
  password: string;
  school_id: string;
}): Promise<{ userId: string; adminId: string }> {
  const sb = getServiceClient();
  const email = `${data.username.trim().toLowerCase()}@admins.snr.local`;

  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) throw authErr ?? new Error("Auth user creation failed");

  const userId = authUser.user.id;
  const { data: admin, error: aErr } = await sb
    .from("admins")
    .insert({ user_id: userId, full_name: data.full_name, school_id: data.school_id })
    .select("id")
    .single();
  if (aErr || !admin) {
    await sb.auth.admin.deleteUser(userId);
    throw aErr ?? new Error("Admin insert failed");
  }

  return { userId, adminId: (admin as { id: string }).id };
}

export async function changeOwnPassword(userId: string, newPassword: string) {
  const sb = getServiceClient();
  const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw error;
}

/** admins has no username column — the login email lives only in auth.users,
 *  so the superadmin admins list resolves it via the service-role admin API. */
export async function getUserEmails(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const sb = getServiceClient();
  const results = await Promise.all(userIds.map((id) => sb.auth.admin.getUserById(id)));
  const map: Record<string, string> = {};
  results.forEach((r, i) => {
    const id = userIds[i];
    if (id && r.data.user?.email) map[id] = r.data.user.email;
  });
  return map;
}

// ── ADMIN: PARENTS ────────────────────────────────────────────────────────────

function generateInviteCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids visual ambiguity
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** Creates a parents row with no user_id yet (the parent claims it later via
 *  /parent/join), links the chosen children, and issues a one-time invite code. */
export async function createParent(data: {
  full_name: string;
  phone?: string;
  student_ids: string[];
  school_id: string;
  created_by: string;
}): Promise<{ parentId: string; inviteCode: string }> {
  const sb = getServiceClient();
  const { data: parent, error: pErr } = await sb
    .from("parents")
    .insert({
      full_name: data.full_name,
      phone: data.phone || null,
      school_id: data.school_id,
      created_by: data.created_by,
    })
    .select("id")
    .single();
  if (pErr || !parent) throw pErr ?? new Error("Parent insert failed");
  const parentId = (parent as { id: string }).id;

  if (data.student_ids.length > 0) {
    const rows = data.student_ids.map((student_id) => ({
      parent_id: parentId,
      student_id,
      school_id: data.school_id,
    }));
    const { error: psErr } = await sb.from("parent_students").insert(rows);
    if (psErr) {
      await sb.from("parents").delete().eq("id", parentId);
      throw psErr;
    }
  }

  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error: inviteErr } = await sb.from("parent_invites").insert({
      code,
      parent_id: parentId,
      school_id: data.school_id,
      created_by: data.created_by,
    });
    if (!inviteErr) break;
    if (attempt === 4) throw inviteErr;
    code = generateInviteCode();
  }

  return { parentId, inviteCode: code };
}

/** Issues a fresh invite code for a parent whose previous one expired. */
export async function regenerateParentInviteCode(
  parentId: string,
  schoolId: string,
  createdBy: string,
): Promise<string> {
  const sb = getServiceClient();
  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await sb
      .from("parent_invites")
      .insert({ code, parent_id: parentId, school_id: schoolId, created_by: createdBy });
    if (!error) return code;
    if (attempt === 4) throw error;
    code = generateInviteCode();
  }
  throw new Error("Failed to generate invite code");
}

export async function deleteParent(parentId: string) {
  const sb = getServiceClient();
  const { error } = await sb.from("parents").delete().eq("id", parentId);
  if (error) throw error;
}

// ── PARENT JOIN (public, unauthenticated invite-claim flow) ───────────────────

export type ParentInviteCheck =
  | { valid: true; fullName: string; children: { id: string; full_name: string }[] }
  | { valid: false; reason: "not_found" | "used" | "expired" };

export async function verifyParentInvite(code: string): Promise<ParentInviteCheck> {
  const sb = getServiceClient();
  const { data: invite } = await sb
    .from("parent_invites")
    .select("id, parent_id, used_at, expires_at")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!invite) return { valid: false, reason: "not_found" };
  if (invite.used_at) return { valid: false, reason: "used" };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { valid: false, reason: "expired" };

  const { data: parent } = await sb
    .from("parents")
    .select("id, full_name")
    .eq("id", invite.parent_id)
    .single();
  if (!parent) return { valid: false, reason: "not_found" };

  const { data: links } = await sb
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", invite.parent_id);
  const studentIds = (links ?? []).map((l: { student_id: string }) => l.student_id);

  let children: { id: string; full_name: string }[] = [];
  if (studentIds.length > 0) {
    const { data: students } = await sb.from("students").select("id, full_name").in("id", studentIds);
    children = (students ?? []) as { id: string; full_name: string }[];
  }

  return { valid: true, fullName: parent.full_name, children };
}

export type ParentJoinResult =
  | { success: true }
  | { success: false; error: "invalid_code" | "username_taken" | "server_error" };

export async function completeParentJoin(data: {
  code: string;
  username: string;
  password: string;
}): Promise<ParentJoinResult> {
  const sb = getServiceClient();
  const { data: invite } = await sb
    .from("parent_invites")
    .select("id, parent_id, used_at, expires_at")
    .eq("code", data.code.trim().toUpperCase())
    .maybeSingle();

  if (!invite || invite.used_at || new Date(invite.expires_at).getTime() < Date.now()) {
    return { success: false, error: "invalid_code" };
  }

  const email = `${data.username.trim().toLowerCase()}@parents.snr.local`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
  });
  if (authErr || !authUser.user) {
    return { success: false, error: "username_taken" };
  }

  const userId = authUser.user.id;
  const { error: updErr } = await sb.from("parents").update({ user_id: userId }).eq("id", invite.parent_id);
  if (updErr) {
    await sb.auth.admin.deleteUser(userId);
    return { success: false, error: "server_error" };
  }

  await sb.from("parent_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  return { success: true };
}
