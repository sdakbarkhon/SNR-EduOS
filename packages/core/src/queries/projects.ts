/* Project queries (migration 33). Tables aren't in the generated types yet, so
 * we use `(db as any)` like the other migration-30+ modules. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db } from "../supabase/factory";
import type {
  Project, ProjectStage, ProjectStageProgress, ProjectAttachment, ProjectSubmission,
  ProjectSubmissionWithStudent, ProjectWithStages, TeacherProjectListItem, StudentProjectListItem,
} from "../types";

// ── Teacher ──
export const createProject = async (
  db: Db,
  input: { teacherId: string; groupId: string; subject: string; title: string; description?: string | null; deadline?: string | null },
): Promise<string> => {
  const { data, error } = await (db as any).from("projects").insert({
    group_id: input.groupId,
    subject: input.subject,
    title: input.title,
    description: input.description ?? null,
    created_by: input.teacherId,
    deadline: input.deadline ?? null,
  }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
};

export const createProjectStages = async (
  db: Db,
  projectId: string,
  stages: Array<{ title: string; description?: string | null }>,
): Promise<void> => {
  if (stages.length === 0) return;
  const { error } = await (db as any).from("project_stages").insert(
    stages.map((s, i) => ({ project_id: projectId, position: i, title: s.title, description: s.description ?? null })),
  );
  if (error) throw error;
};

export const updateProject = async (
  db: Db,
  projectId: string,
  data: { title?: string; description?: string | null; deadline?: string | null; subject?: string },
): Promise<void> => {
  const { error } = await (db as any).from("projects").update(data).eq("id", projectId);
  if (error) throw error;
};

export const deleteProject = async (db: Db, projectId: string): Promise<void> => {
  const { error } = await (db as any).from("projects").delete().eq("id", projectId);
  if (error) throw error;
};

export const getTeacherProjects = async (db: Db): Promise<TeacherProjectListItem[]> => {
  const { data, error } = await (db as any).from("projects")
    .select("*, group:groups!inner(name, subject, student_groups(count)), stages:project_stages(count), submissions:project_submissions(id, is_submitted)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((p) => ({
    ...p,
    group: { name: p.group?.name ?? "", subject: p.group?.subject ?? "" },
    stageCount: p.stages?.[0]?.count ?? 0,
    totalStudents: p.group?.student_groups?.[0]?.count ?? 0,
    submittedCount: (p.submissions ?? []).filter((s: any) => s.is_submitted).length,
  })) as TeacherProjectListItem[];
};

export const getProjectWithStages = async (db: Db, projectId: string): Promise<ProjectWithStages | null> => {
  const { data, error } = await (db as any).from("projects")
    .select("*, group:groups!inner(name, subject)")
    .eq("id", projectId).maybeSingle();
  if (error || !data) return null;
  const { data: stages } = await (db as any).from("project_stages")
    .select("*").eq("project_id", projectId).order("position");
  return { ...(data as any), stages: (stages ?? []) as ProjectStage[] } as ProjectWithStages;
};

export const getProjectSubmissions = async (db: Db, projectId: string): Promise<ProjectSubmissionWithStudent[]> => {
  const { data, error } = await (db as any).from("project_submissions")
    .select("*, student:students!inner(id, full_name, avatar_url), progress:project_stage_progress(*), attachments:project_attachments(*)")
    .eq("project_id", projectId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((s) => ({
    ...s,
    progress: (s.progress ?? []) as ProjectStageProgress[],
    attachments: (s.attachments ?? []) as ProjectAttachment[],
  })) as ProjectSubmissionWithStudent[];
};

export const gradeProjectSubmission = async (
  db: Db,
  { submissionId, teacherId, grade, comment }: { submissionId: string; teacherId: string; grade: number; comment: string },
): Promise<void> => {
  const { error } = await (db as any).from("project_submissions").update({
    grade, teacher_comment: comment || null, graded_at: new Date().toISOString(), graded_by: teacherId,
  }).eq("id", submissionId);
  if (error) throw error;
};

// ── Student ──
export const getStudentProjects = async (db: Db, studentId: string): Promise<StudentProjectListItem[]> => {
  const { data, error } = await (db as any).from("projects")
    .select("*, teacher:teachers(full_name), stages:project_stages(count), submissions:project_submissions(id, is_submitted, grade, student_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const out: StudentProjectListItem[] = [];
  for (const p of (data ?? []) as any[]) {
    const sub = (p.submissions ?? []).find((s: any) => s.student_id === studentId) ?? null;
    let completedCount = 0;
    if (sub) {
      const { data: prog } = await (db as any).from("project_stage_progress")
        .select("is_completed").eq("submission_id", sub.id);
      completedCount = (prog ?? []).filter((x: any) => x.is_completed).length;
    }
    out.push({
      ...p,
      teacherName: p.teacher?.full_name ?? null,
      stageCount: p.stages?.[0]?.count ?? 0,
      completedCount,
      submission: sub
        ? { id: sub.id, project_id: p.id, student_id: studentId, is_submitted: sub.is_submitted, submitted_at: null, grade: sub.grade ?? null, teacher_comment: null, graded_at: null, graded_by: null }
        : null,
    });
  }
  return out;
};

export const getProjectDetailForStudent = async (
  db: Db,
  projectId: string,
  studentId: string,
): Promise<{ project: ProjectWithStages; submission: ProjectSubmission | null; progress: ProjectStageProgress[]; attachments: ProjectAttachment[] } | null> => {
  const project = await getProjectWithStages(db, projectId);
  if (!project) return null;
  const { data: sub } = await (db as any).from("project_submissions")
    .select("*").eq("project_id", projectId).eq("student_id", studentId).maybeSingle();
  let progress: ProjectStageProgress[] = [];
  let attachments: ProjectAttachment[] = [];
  if (sub) {
    const [{ data: prog }, { data: att }] = await Promise.all([
      (db as any).from("project_stage_progress").select("*").eq("submission_id", (sub as any).id),
      (db as any).from("project_attachments").select("*").eq("submission_id", (sub as any).id),
    ]);
    progress = (prog ?? []) as ProjectStageProgress[];
    attachments = (att ?? []) as ProjectAttachment[];
  }
  return { project, submission: (sub as ProjectSubmission | null) ?? null, progress, attachments };
};

export const startProject = async (db: Db, projectId: string, studentId: string): Promise<ProjectSubmission> => {
  const { data, error } = await (db as any).from("project_submissions")
    .insert({ project_id: projectId, student_id: studentId })
    .select("*").single();
  if (error) throw error;
  return data as ProjectSubmission;
};

export const toggleStageCompletion = async (
  db: Db,
  submissionId: string,
  stageId: string,
  isCompleted: boolean,
  notes?: string | null,
): Promise<void> => {
  const { data: existing } = await (db as any).from("project_stage_progress")
    .select("id").eq("submission_id", submissionId).eq("stage_id", stageId).maybeSingle();
  const payload: any = { is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null };
  if (notes !== undefined) payload.student_notes = notes;
  if (existing) {
    const { error } = await (db as any).from("project_stage_progress").update(payload).eq("id", (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await (db as any).from("project_stage_progress")
      .insert({ submission_id: submissionId, stage_id: stageId, ...payload });
    if (error) throw error;
  }
};

export const uploadProjectAttachment = async (
  db: Db,
  { studentId, projectId, submissionId, stageId, file }: { studentId: string; projectId: string; submissionId: string; stageId: string | null; file: File },
): Promise<ProjectAttachment> => {
  const path = `${studentId}/${projectId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await db.storage.from("project-files").upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { data, error } = await (db as any).from("project_attachments").insert({
    submission_id: submissionId, stage_id: stageId, storage_path: path,
    original_filename: file.name, size_bytes: file.size,
  }).select("*").single();
  if (error) throw error;
  return data as ProjectAttachment;
};

export const deleteProjectAttachment = async (db: Db, attachmentId: string, storagePath: string): Promise<void> => {
  await db.storage.from("project-files").remove([storagePath]).catch(() => null);
  const { error } = await (db as any).from("project_attachments").delete().eq("id", attachmentId);
  if (error) throw error;
};

export const getProjectAttachmentUrl = async (db: Db, storagePath: string, downloadName?: string): Promise<string> => {
  const { data, error } = await db.storage.from("project-files")
    .createSignedUrl(storagePath, 3600, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data!.signedUrl;
};

export const submitProject = async (db: Db, submissionId: string): Promise<void> => {
  const { error } = await (db as any).from("project_submissions")
    .update({ is_submitted: true, submitted_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (error) throw error;
};
