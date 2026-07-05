"use client";

import { MessageCircle } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export default function ParentMessagesPage() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 text-pink-500">
        <MessageCircle className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-lg font-bold text-gray-800">{t.messagesStubTitle}</h1>
        <p className="mt-1 max-w-sm text-sm text-gray-500">{t.messagesStubDescription}</p>
      </div>
    </div>
  );
}
