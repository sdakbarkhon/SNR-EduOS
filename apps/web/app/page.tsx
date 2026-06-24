import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, roleToHome } from "@/lib/auth";

// Root entry: route by DB role (admin > teacher > student).
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const role = await getCurrentUserRole(supabase, user.id);
  redirect(roleToHome(role));
}
