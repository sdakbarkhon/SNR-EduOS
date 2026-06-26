import type { Db } from "../supabase/factory";
import type { Subject, SubjectWithGroup } from "../types";

export const SUBJECT_DEFAULTS: Record<string, { icon: string; color: string }> = {
  "Математика":                { icon: "Calculator",   color: "#F5A623" },
  "Алгебра":                   { icon: "Calculator",   color: "#F5A623" },
  "Геометрия":                 { icon: "Calculator",   color: "#F5A623" },
  "Русский язык":              { icon: "BookOpen",     color: "#EF4444" },
  "Узбекский язык":            { icon: "Globe",        color: "#F97316" },
  "Английский язык":           { icon: "Languages",    color: "#F0556B" },
  "Литература":                { icon: "BookText",     color: "#F43F5E" },
  "История":                   { icon: "Scroll",       color: "#B5793A" },
  "География":                 { icon: "Map",          color: "#14B8A6" },
  "Биология":                  { icon: "Leaf",         color: "#2DBE7E" },
  "Физика":                    { icon: "Atom",         color: "#39B6F5" },
  "Химия":                     { icon: "FlaskConical", color: "#9B5DE5" },
  "Информатика":               { icon: "Monitor",      color: "#7A4DFF" },
  "Программирование":          { icon: "Code",         color: "#0EA5E9" },
  "Робототехника":             { icon: "Bot",          color: "#2D5BFF" },
  "Физкультура":               { icon: "Dumbbell",     color: "#F97316" },
  "Музыка":                    { icon: "Music",        color: "#EC4899" },
  "Изобразительное искусство": { icon: "Palette",      color: "#8B5CF6" },
  "Технология":                { icon: "Hammer",       color: "#71717A" },
  "Окружающий мир":            { icon: "TreePine",     color: "#16A34A" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export async function getSubjects(
  db: Db,
  opts?: { groupId?: string; teacherId?: string },
): Promise<SubjectWithGroup[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db as AnyDb)
    .from("subjects")
    .select("*, group:groups(id, name), teacher:teachers(id, full_name)")
    .order("name");
  if (opts?.groupId)   q = q.eq("group_id",   opts.groupId);
  if (opts?.teacherId) q = q.eq("teacher_id", opts.teacherId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SubjectWithGroup[];
}

export const getSubjectsForGroup = (db: Db, groupId: string) =>
  getSubjects(db, { groupId });

export const getTeacherSubjects = (db: Db, teacherId: string) =>
  getSubjects(db, { teacherId });

export async function createSubject(
  db: Db,
  data: { name: string; group_id: string; teacher_id?: string | null; icon?: string; color?: string },
): Promise<Subject> {
  const defaults = SUBJECT_DEFAULTS[data.name] ?? { icon: "BookOpen", color: "#64748B" };
  const { data: row, error } = await (db as AnyDb)
    .from("subjects")
    .insert({
      name:       data.name,
      group_id:   data.group_id,
      teacher_id: data.teacher_id ?? null,
      icon:       data.icon  ?? defaults.icon,
      color:      data.color ?? defaults.color,
    })
    .select()
    .single();
  if (error) throw error;
  return row as Subject;
}

export async function updateSubject(
  db: Db,
  id: string,
  updates: Partial<Pick<Subject, "name" | "teacher_id" | "icon" | "color">>,
): Promise<Subject> {
  const { data, error } = await (db as AnyDb)
    .from("subjects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Subject;
}

export async function deleteSubject(db: Db, id: string): Promise<void> {
  const { error } = await (db as AnyDb).from("subjects").delete().eq("id", id);
  if (error) throw error;
}
