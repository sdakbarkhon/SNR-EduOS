import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTeacherEmail } from "@snr/core";

// Root entry: route by real auth state (never a hardcoded default).
//  • no session            → /login
//  • teacher account        → /teacher/dashboard
//  • student account        → /dashboard
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  redirect(isTeacherEmail(user.email) ? "/teacher/dashboard" : "/dashboard");
}
