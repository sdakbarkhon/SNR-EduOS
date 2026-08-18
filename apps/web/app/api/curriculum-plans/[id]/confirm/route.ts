import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { confirmCurriculumPlan, deleteCurriculumPlan, getCurriculumPlanById } from "@snr/core";

// Учитель согласился с предложенными темами — план становится обычным.
// Или отказался — черновик удаляется целиком.
//
// ПОЧЕМУ ОТКАЗ УДАЛЯЕТ, А НЕ ОСТАВЛЯЕТ. План в состоянии 'preview' занимает
// пару (группа, предмет), на которую наложено ограничение уникальности: пока
// он висит, учитель не может ни собрать план из другой книги, ни загрузить
// готовый. Брошенный черновик — это запертая пара, поэтому «Отменить» его
// убирает. Темы уходят вместе с ним каскадом; уроков по ним быть не может —
// пока план в предпросмотре, создавать их нельзя.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = await params;
  const db = await createClient();

  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: teacher } = await (db as any)
    .from("teachers").select("id").eq("user_id", user.id).single();
  if (!teacher) return NextResponse.json({ error: "Not a teacher" }, { status: 403 });

  const plan = await getCurriculumPlanById(db, planId).catch(() => null);
  if (!plan) return NextResponse.json({ error: "План не найден" }, { status: 404 });
  if (plan.teacher_id !== teacher.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (plan.status !== "preview") {
    return NextResponse.json({ error: "Этот план уже не в предпросмотре" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { accept?: boolean };

  if (body.accept === false) {
    await deleteCurriculumPlan(db, planId);
    return NextResponse.json({ ok: true, deleted: true });
  }

  await confirmCurriculumPlan(db, planId);
  return NextResponse.json({ ok: true, deleted: false });
}
