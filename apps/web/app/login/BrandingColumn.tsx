import Image from "next/image";
import type { ReactNode } from "react";
import { Star, Presentation, Users, Box } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

function FeatureItem({
  icon, title, description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/50 shadow-sm backdrop-blur-sm">
        {icon}
      </div>
      <div>
        <h3 className="mb-1 text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs font-medium leading-tight text-slate-700">{description}</p>
      </div>
    </div>
  );
}

export function BrandingColumn({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;

  return (
    <div className="z-10 flex h-full w-full max-w-2xl flex-col justify-between">
      <div>
        <Image
          src="/login/logo.png"
          alt="SNR EduOS"
          width={512}
          height={227}
          priority
          className="h-28 w-auto object-contain lg:h-36"
        />
        <p className="mt-4 text-2xl font-medium tracking-wide text-slate-800 lg:text-[32px]">
          {t.tagline}
        </p>
      </div>

      <div className="grid w-full max-w-[600px] grid-cols-2 gap-6 md:grid-cols-4">
        <FeatureItem
          icon={<Star className="h-8 w-8 text-[#FFB020]" fill="#FFB020" />}
          title={t.features.learn}
          description={t.features.learnDesc}
        />
        <FeatureItem
          icon={<Presentation className="h-8 w-8 text-[#00B4D8]" strokeWidth={2} />}
          title={t.features.grow}
          description={t.features.growDesc}
        />
        <FeatureItem
          icon={<Users className="h-8 w-8 text-[#F15BB5]" fill="#F15BB5" />}
          title={t.features.connect}
          description={t.features.connectDesc}
        />
        <FeatureItem
          icon={<Box className="h-8 w-8 text-[#7209B7]" fill="#7209B7" />}
          title={t.features.create}
          description={t.features.createDesc}
        />
      </div>
    </div>
  );
}
