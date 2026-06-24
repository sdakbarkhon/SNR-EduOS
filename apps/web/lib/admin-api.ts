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
    .insert({ user_id: userId, full_name: data.full_name, username: data.username })
    .select("id")
    .single();
  if (stuErr || !student) {
    await sb.auth.admin.deleteUser(userId);
    throw stuErr ?? new Error("Student insert failed");
  }

  const { error: sgErr } = await sb
    .from("student_groups")
    .insert({ student_id: (student as { id: string }).id, group_id: data.group_id });
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
    .insert({ user_id: userId, full_name: data.full_name, username: data.username })
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
