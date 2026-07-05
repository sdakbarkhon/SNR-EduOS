"use client";

import { Phone } from "lucide-react";
import { getDictionary, type getStudentById } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import type { ParentChild } from "@/lib/parent-child";

type Student = Awaited<ReturnType<typeof getStudentById>>;

function formatBirthDate(iso: string, tag: string) {
  return new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" });
}

const LOCALE_TAG: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };

export function ProfileView({ child, student }: { child: ParentChild; student: Student | null }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;
  const showToast = useToast();
  const tag = LOCALE_TAG[locale] ?? "ru-RU";

  const groups = (student?.student_groups ?? []).map((sg) => sg.groups).filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.profileTitle}</h1>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <Avatar name={child.full_name} src={student?.avatar_url ?? undefined} size={64} />
          <div>
            <p className="text-lg font-bold text-gray-800">{child.full_name}</p>
            {child.className && <p className="text-sm text-gray-500">{child.className}</p>}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.birthDateLabel}</dt>
            <dd className="mt-1 text-sm font-medium text-gray-700">
              {student?.birth_date ? formatBirthDate(student.birth_date, tag) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.classesLabel}</dt>
            <dd className="mt-1 text-sm font-medium text-gray-700">
              {groups.length > 0 ? groups.map((g) => g.name).join(", ") : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.curatorLabel}</h2>
        {student?.curator ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{student.curator.full_name}</p>
              {student.curator.phone && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                  <Phone className="h-3 w-3" /> {student.curator.phone}
                </p>
              )}
            </div>
            <button
              onClick={() => showToast(t.curatorComingSoon)}
              className="shrink-0 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
            >
              {t.contactCurator}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t.noCurator}</p>
        )}
      </div>
    </div>
  );
}
