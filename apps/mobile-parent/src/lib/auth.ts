import { signInWithUsername } from "@snr/core";
import { getSupabase } from "./supabase";

export type ParentProfile = { id: string; fullName: string };

/** Вошли, но роль не parent (студент/учитель/админ ошибся приложением) —
 *  либо вошли под parent-доменом, но строки в `parents` не нашлось. */
export class NotParentError extends Error {
  constructor(public reason: "wrong_role" | "no_profile") {
    super(reason);
  }
}

function isAuthCredentialsError(e: unknown): boolean {
  return !!e && typeof e === "object" && "status" in e && "message" in e;
}

/** Логин по логину/паролю (пробует домены student→teacher→admin→parent через
 *  signInWithUsername), затем проверяет, что вошедший — родитель. Если роль не
 *  parent или строка в `parents` не найдена — разлогинивает и бросает NotParentError. */
export async function loginAsParent(
  username: string,
  password: string,
): Promise<ParentProfile> {
  // getSupabase() throws if EXPO_PUBLIC_SUPABASE_URL/ANON_KEY weren't baked
  // into this build (missing/empty .env.local at `eas update`/`expo export`
  // time — these are inlined at BUILD time, not read from a device
  // "environment" at runtime). Previously this threw uncaught, past
  // loginAsParent entirely, and LoginScreen's catch-all mapped it to the
  // exact same "Проверьте соединение" text as a real network failure —
  // silently masking a config bug as a connectivity bug. Log + rethrow with
  // a distinct message so LoginScreen can tell the two apart.
  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch (e) {
    console.error("[loginAsParent] getSupabase() failed (missing EXPO_PUBLIC_SUPABASE_* build-time env vars):", (e as Error)?.message);
    throw new Error("config_error");
  }
  let result;
  try {
    result = await signInWithUsername(db, username, password);
  } catch (e) {
    if (isAuthCredentialsError(e)) throw e;
    console.error("[loginAsParent] signInWithUsername threw an unexpected (non-credentials) error:", e);
    throw new Error("network_error");
  }
  if (result.error) throw result.error;
  if (result.role !== "parent") {
    await db.auth.signOut();
    throw new NotParentError("wrong_role");
  }
  const profile = await fetchParentProfile();
  if (!profile) {
    await db.auth.signOut();
    throw new NotParentError("no_profile");
  }
  return profile;
}

export async function fetchParentProfile(): Promise<ParentProfile | null> {
  const db = getSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  // database.types.ts не перегенерирован после миграции 74 (parents) — тот же
  // обход, что и в apps/web/lib/parent-context.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = db as any;
  const { data, error } = await sb
    .from("parents")
    .select("id, full_name")
    .eq("user_id", auth.user.id)
    .single();
  if (error || !data) return null;
  return { id: data.id, fullName: data.full_name };
}

export { isAuthCredentialsError };
