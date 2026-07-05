"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { actionCreateParent } from "../actions";

type Student = { id: string; full_name: string; username: string };

export function NewParentForm({ students }: { students: Student[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.adminParents;
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ inviteCode: string } | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) || s.username.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleStudent(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || selectedIds.length === 0) {
      setError(t.fieldFullName + " / " + t.selectChildren);
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("full_name", fullName.trim());
        fd.set("phone", phone.trim());
        selectedIds.forEach((id) => fd.append("student_ids", id));
        const res = await actionCreateParent(fd);
        setResult(res);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function copy(text: string, kind: "code" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (result) {
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/parent/join?code=${result.inviteCode}` : "";
    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">{t.inviteCreatedTitle}</h1>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.inviteCodeLabel}</p>
          <p className="mb-4 text-3xl font-bold tracking-widest text-violet-700">{result.inviteCode}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => copy(result.inviteCode, "code")}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {t.copyCode}
            </button>
            <button
              onClick={() => copy(joinUrl, "link")}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {t.copyLink}
            </button>
          </div>
        </div>
        <button
          onClick={() => router.push("/admin/parents")}
          className="w-full rounded-xl bg-gray-800 py-2.5 text-sm font-medium text-white hover:bg-gray-900"
        >
          {t.doneBtn}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/parents" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{t.addParentTitle}</h1>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldFullName}</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldPhone}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldChildren}</label>
          <p className="text-xs text-gray-400">{t.selectChildren}</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="mb-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
          <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100">
            {filteredStudents.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 text-sm last:border-0 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                />
                <span className="text-gray-800">{s.full_name}</span>
                <span className="text-gray-400">@{s.username}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {isPending ? t.creating : t.createBtn}
        </button>
      </form>
    </div>
  );
}
