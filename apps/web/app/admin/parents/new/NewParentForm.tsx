"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { AdminPhoneInput, storedFromDigits } from "@/components/admin/PhoneInput";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import { actionCreateParent } from "../actions";

type Student = { id: string; full_name: string; username: string };

export function NewParentForm({ students }: { students: Student[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.adminParents;
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  // Девять цифр без кода страны — код рисует само поле и стереть его нельзя.
  const [phoneDigits, setPhoneDigits] = useState("");
  // Необязательные адреса под будущий вход через Google/Apple (миграция 201).
  const [googleEmail, setGoogleEmail] = useState("");
  const [appleEmail, setAppleEmail] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Пароля здесь нет намеренно — см. комментарий у экрана результата ниже.
  const [result, setResult] = useState<{ phone: string } | null>(null);
  const [copied, setCopied] = useState<"phone" | "link" | null>(null);
  const guard = useSubmitGuard();

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) || s.username.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleStudent(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Z.2.8 — телефон обязателен: он ключ входа.
    if (!fullName.trim() || phoneDigits.length !== 9 || selectedIds.length === 0) {
      setError(t.parentPhoneRequired);
      return;
    }
    guard(() => startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("full_name", fullName.trim());
        fd.set("phone", storedFromDigits(phoneDigits));
        fd.set("google_email", googleEmail.trim());
        fd.set("apple_email", appleEmail.trim());
        selectedIds.forEach((id) => fd.append("student_ids", id));
        const res = await actionCreateParent(fd);
        setResult({ phone: storedFromDigits(phoneDigits) });
      } catch (err) {
        setError(humanizeAdminError(err, locale as Locale));
      }
    }));
  }

  function copy(text: string, kind: "phone" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  // Пароль админу больше НЕ показывается (17.08.2026). Учётной записи он
  // технически нужен и генерируется как раньше, но родитель им нигде не
  // пользуется: вход идёт по номеру телефона с одноразовым кодом — и на сайте,
  // и в приложении. Прежний экран показывал пароль крупно, называл его «кодом»
  // на кнопке «Скопировать код» и писал, что он нужен приложению. Админ
  // диктовал этот пароль родителю как код входа, и родитель не входил.
  // Настоящий код появляется только после запроса из приложения и смотрится
  // круглой стрелкой рядом со статусом родителя в списке.
  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">{t.parentCreatedTitle}</h1>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldPhone}</p>
          <p className="mb-4 text-xl font-bold text-gray-800">{result.phone}</p>
          <button
            onClick={() => copy(result.phone, "phone")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            {copied === "phone" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {t.copyPhone}
          </button>
        </div>
        <p className="text-center text-xs leading-relaxed text-gray-500">{t.parentLoginHint}</p>
        <p className="text-center text-xs leading-relaxed text-gray-400">{t.parentCreatedNext}</p>
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
          {/* Поле было подписано «(необязательно)» при required в разметке:
              подпись обещала одно, форма требовала другое. Оставили
              обязательным — родитель входит именно по номеру, — а подпись
              привели в соответствие и добавили пояснение зачем. */}
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldPhone}</label>
          <p className="text-xs text-gray-400">{t.fieldPhoneHint}</p>
          <AdminPhoneInput digits={phoneDigits} onChange={setPhoneDigits} required />
        </div>
        {/* Вход через Google/Apple: адреса вписывает администратор, сам
            родитель нигде не регистрируется. Поля необязательные — без них
            вход по номеру и коду работает как работал. */}
        <div className="flex flex-col gap-1 rounded-xl bg-gray-50/70 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t.fieldSocialLogins}
          </label>
          <p className="text-xs text-gray-400">{t.fieldSocialLoginsHint}</p>

          <label className="mt-2 text-xs font-medium text-gray-600">{t.fieldGoogleEmail}</label>
          <input
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            inputMode="email"
            autoCapitalize="none"
            placeholder="ivan@gmail.com"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />

          <label className="mt-2 text-xs font-medium text-gray-600">{t.fieldAppleEmail}</label>
          <input
            value={appleEmail}
            onChange={(e) => setAppleEmail(e.target.value)}
            inputMode="email"
            autoCapitalize="none"
            placeholder="ivan@icloud.com"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
          <p className="mt-1 text-xs text-amber-600">{t.fieldAppleEmailNote}</p>
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
