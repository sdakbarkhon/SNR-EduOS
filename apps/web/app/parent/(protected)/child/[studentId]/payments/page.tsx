import { createClient } from "@/lib/supabase/server";
import { getPayments, getCharges, getStudentById } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { PaymentsView } from "./PaymentsView";

export default async function ChildPaymentsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const ctx = await getParentContext();
  const child = ctx ? resolveSelectedChild(ctx.children, studentId) : null;
  if (!child) return null;

  const db = await createClient();
  const [payments, charges, student] = await Promise.all([
    Promise.resolve(getPayments(db, studentId)).catch(() => []),
    Promise.resolve(getCharges(db, studentId)).catch(() => []),
    getStudentById(db, studentId).catch(() => null),
  ]);

  return (
    <PaymentsView
      child={child}
      payments={payments}
      charges={charges}
      balance={student?.balance ?? null}
      status={student?.status ?? null}
    />
  );
}
