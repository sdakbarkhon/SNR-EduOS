"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale, type TeacherAiPendingReview } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ChevronLeft, Sparkles } from "lucide-react";
import { AiReviewModal } from "@/components/teacher/ReviewModals";

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

export function TeacherAiReviewView({ reviews: initialReviews }: { reviews: TeacherAiPendingReview[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();

  const [reviews, setReviews] = useState(initialReviews);
  const [active, setActive] = useState<TeacherAiPendingReview | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/teacher/homework" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-brand-ink">
          <Sparkles size={18} className="text-brand-blue" /> {d.teacher.aiReviewPageTitle}
        </h1>
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        {reviews.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.teacher.aiReviewEmpty}</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id}
                className="flex cursor-pointer items-center gap-3 rounded-[14px] bg-white/60 p-3 transition-colors hover:bg-white/90"
                onClick={() => setActive(r)}>
                <Avatar name={r.student.full_name} url={r.student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{r.student.full_name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-brand-ink-muted">
                    {r.homework.title} · {r.homework.group.name}
                  </div>
                </div>
                {r.ai_grade != null && (
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[12px] font-bold text-brand-blue">
                    {d.teacher.aiGrade}: {r.ai_grade}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {active && (
        <AiReviewModal
          review={active}
          onClose={() => setActive(null)}
          onResolved={() => {
            setReviews((rs) => rs.filter((r) => r.id !== active.id));
            setActive(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
