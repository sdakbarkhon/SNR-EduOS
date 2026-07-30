"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassSheet } from "@/components/parent/glass/GlassSheet";
import { GlassButton } from "@/components/parent/glass/GlassButton";
import { ink1, ink2 } from "@/lib/parent/glass-tokens";
import { DIVIDER } from "@/app/parent/(app)/_ui/screen-tokens";

/* Глифы лежат на цветных градиентных плитках — белые в обеих темах,
   поэтому stroke="#FFFFFF" здесь литерал, а не токен. */
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const CheckSquareIcon = () => (
  <IconBase>
    <path d="M9 11l3 3 8-8" />
    <path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
  </IconBase>
);
const ClipboardIcon = () => (
  <IconBase>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x={8} y={2} width={8} height={4} rx={1} />
  </IconBase>
);
const CreditCardIcon = () => (
  <IconBase>
    <rect x={2} y={5} width={20} height={14} rx={2} />
    <path d="M2 10h20" />
  </IconBase>
);
const ChatIcon = () => (
  <IconBase>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </IconBase>
);

/** «Возможности приложения» — веб-аналог apps/mobile-parent AuthFeaturesSheet, 1:1 по составу. */
export function FeaturesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).parentApp.auth;

  const rows = [
    { title: t.featEduTitle, sub: t.featEduSub, grad: "linear-gradient(135deg, #34D399, #059669)", icon: <CheckSquareIcon /> },
    { title: t.featHwTitle, sub: t.featHwSub, grad: "linear-gradient(135deg, #60A5FA, #2563EB)", icon: <ClipboardIcon /> },
    { title: t.featPayTitle, sub: t.featPaySub, grad: "linear-gradient(135deg, #FB923C, #EF4444)", icon: <CreditCardIcon /> },
    { title: t.featChatTitle, sub: t.featChatSub, grad: "linear-gradient(135deg, #A78BFA, #7C3AED)", icon: <ChatIcon /> },
  ];

  return (
    <GlassSheet visible={visible} onClose={onClose}>
      <div className="px-5 pb-1 pt-0.5">
        <h2 className="text-[14px] font-extrabold" style={{ color: ink1 }}>
          {t.moreTitle}
        </h2>
        <p className="mt-0.5 pb-2 text-[10px] font-semibold leading-[1.5]" style={{ color: ink2 }}>
          {t.moreIntro}
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
