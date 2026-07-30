"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassSheet } from "@/components/parent/glass/GlassSheet";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { DIVIDER } from "@/app/parent/(app)/_ui/screen-tokens";

/* Глифы шторки лежат на цветных градиентных плитках — белые в обеих темах,
   поэтому stroke="#FFFFFF" здесь литерал, а не токен. */
function PhoneIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={4} width={20} height={16} rx={2} />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

/** «Нужна помощь?» — 1:1 с apps/mobile-parent/src/screens/auth/sheets/AuthHelpSheet.tsx. */
export function AuthHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).parentApp.auth;

  const rows = [
    { title: t.helpPhoneRowTitle, sub: t.helpPhoneValue, grad: "linear-gradient(135deg, #34D399, #059669)", icon: <PhoneIcon /> },
    { title: t.helpEmailRowTitle, sub: t.helpEmailValue, grad: "linear-gradient(135deg, #60A5FA, #2563EB)", icon: <MailIcon /> },
  ];

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <div className="px-5 pb-1 pt-0.5">
        <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
          {t.helpTitle}
        </h2>
        <p className="mt-0.5 pb-2 text-[10px] font-semibold leading-[1.5]" style={{ color: ink2 }}>
          {t.helpSub}
        </p>

        <div>
          {rows.map((r, i) => (
            <div
              key={r.title}
              className="flex items-center gap-2.5 py-2.5"
              style={i > 0 ? { borderTop: `1px solid ${DIVIDER}` } : undefined}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]"
                style={{ background: r.grad, boxShadow: "0 6px 14px rgba(0,0,0,0.15)" }}
              >
                {r.icon}
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-extrabold" style={{ color: ink1 }}>
                  {r.title}
                </div>
                <div className="mt-0.5 text-[9.5px] font-semibold" style={{ color: ink2 }}>
                  {r.sub}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pb-2 pt-2.5">
          <GlassButton onClick={onClose}>{t.close}</GlassButton>
        </div>
      </div>
    </GlassSheet>
  );
}
