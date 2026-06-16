import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Temporary encoding diagnostic — remove after fix
// Auth-required: returns 401 if not logged in
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: groups, error } = await supabase
    .from("groups")
    .select("name")
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const name = groups?.[0]?.name ?? "(no groups)";
  const encoded = new TextEncoder().encode(name);
  const hex = Array.from(encoded)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  return NextResponse.json({
    url_prefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
    key_prefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20),
    key_type: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith("eyJ")
      ? "jwt_legacy"
      : "other",
    group_name: name,
    group_name_hex: hex,
    node_version: process.version,
  });
}
