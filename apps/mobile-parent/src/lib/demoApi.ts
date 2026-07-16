// P2: мобильные вызовы /api/demo/* — вне webApi.ts, потому что демо-claim
// делается ДО входа в Supabase (у webApi обязательный Bearer). Endpoint
// /api/demo/claim принимает role='parent' и возвращает { username, email,
// password, session_token }, чтобы мобилка сама залогинилась через
// signInWithPassword и сохранила session_token в SecureStore для heartbeat/
// release.

import Constants from "expo-constants";

type ExpoExtra = { webApiBaseUrl?: string };

function baseUrl(): string {
  const extra = Constants.expoConfig?.extra as ExpoExtra | undefined;
  if (!extra?.webApiBaseUrl) throw new Error("webApiBaseUrl отсутствует (app.json expo.extra)");
  return extra.webApiBaseUrl;
}

export interface DemoClaimResult {
  role: "student" | "teacher" | "parent";
  redirect_to: string;
  username: string | null;
  email: string;
  password: string;
  session_token: string;
}

export async function claimDemoSlot(role: "parent" | "student" | "teacher", subjectSlug?: string): Promise<DemoClaimResult> {
  const res = await fetch(`${baseUrl()}/api/demo/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, subject_slug: subjectSlug ?? null }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: string }).error;
    throw new Error(err ?? `demo_claim_failed_${res.status}`);
  }
  return json as DemoClaimResult;
}

export async function heartbeatDemoSlot(sessionToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/demo/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    const json = (await res.json().catch(() => ({}))) as { active?: boolean };
    return json.active === true;
  } catch {
    return false;
  }
}

export async function releaseDemoSlot(sessionToken: string): Promise<void> {
  try {
    await fetch(`${baseUrl()}/api/demo/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
  } catch {
    // best-effort: если release не прошёл — sweep протухнет через 15 мин
  }
}
