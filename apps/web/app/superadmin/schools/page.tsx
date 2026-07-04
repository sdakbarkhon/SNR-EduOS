import { createClient } from "@/lib/supabase/server";

export default async function SuperAdminSchoolsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: schools } = await (supabase as any)
    .from("schools")
    .select("id, name, code, created_at")
    .order("created_at");

  const rows = (schools ?? []) as { id: string; name: string; code: string | null; created_at: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Школы</h1>
        <p className="mt-1 text-sm text-gray-500">Все школы, использующие SNR EduOS</p>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Создана</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">Школ пока нет</td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.code ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(s.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
