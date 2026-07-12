import { createClient } from "@/lib/supabase/server";
import { getPayments, getCharges, getStudentById } from "@snr/core";
import { getParentContext, resolveSelectedChild } from "@/lib/parent-context";
import { safeQuery } from "@/lib/safe-query";
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
  const [paymentsRes, chargesRes, studentRes] = await Promise.all([
    safeQuery(Promise.resolve(getPayments(db, studentId)), [], "ChildPaymentsPage.payments"),
    safeQuery(Promise.resolve(getCharges(db, studentId)), [], "ChildPaymentsPage.charges"),
    safeQuery(getStudentById(db, studentId), null, "ChildPaymentsPage.student"),
  ]);
  const student = studentRes.data;

  return (
    <PaymentsView
      child={child}
      payments={paymentsRes.data}
      charges={chargesRes.data}
      balance={student?.balance ?? null}
      status={student?.status ?? null}
    />
  );
}
