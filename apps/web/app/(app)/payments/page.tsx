import {
  defaultLocale,
  getDictionary,
  getMyStudent,
  getMyGroups,
  getPayments,
  getCharges,
} from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { PaymentsView } from "./PaymentsView";

export default async function PaymentsPage() {
  const db = await createClient();
  const d = getDictionary(defaultLocale);

  const [student, groups, payments, charges] = await Promise.all([
    getMyStudent(db),
    getMyGroups(db),
    getPayments(db),
    getCharges(db),
  ]);

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900">
        {d.payments.title}
      </h1>
      <PaymentsView
        student={student}
        groups={groups}
        initialPayments={payments}
        initialCharges={charges}
      />
    </>
  );
}
