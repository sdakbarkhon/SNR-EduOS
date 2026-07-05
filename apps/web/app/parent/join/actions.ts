"use server";

import { verifyParentInvite, completeParentJoin, type ParentInviteCheck, type ParentJoinResult } from "@/lib/admin-api";

export async function actionVerifyInviteCode(code: string): Promise<ParentInviteCheck> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false, reason: "not_found" };
  return verifyParentInvite(trimmed);
}

export async function actionCompleteJoin(formData: FormData): Promise<ParentJoinResult> {
  const code = String(formData.get("code") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!code || !username || !password) {
    return { success: false, error: "invalid_code" };
  }
  return completeParentJoin({ code, username, password });
}
