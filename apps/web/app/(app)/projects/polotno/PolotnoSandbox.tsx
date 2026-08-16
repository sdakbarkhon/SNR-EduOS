"use client";

/**
 * Обёртка пробной карточки Polotno.
 *
 * Единственное её дело — подключить редактор ТОЛЬКО на клиенте. Так требует
 * документация Polotno для Next.js: `dynamic(..., { ssr: false })`, иначе Next
 * попытается отрисовать редактор на сервере и упадёт — ему нужны window и
 * canvas, которых там нет.
 *
 * Заодно этот файл — граница бандла: пока карточку не открыли, тяжёлый код
 * редактора (polotno + blueprint + konva) в браузер не едет вовсе.
 */

import dynamic from "next/dynamic";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components";

const Editor = dynamic(() => import("@/components/polotno/PolotnoEditor"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).sandbox.polotno;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="text-sm text-slate-500">{t.loading}</p>
    </div>
  );
}

export function PolotnoSandbox() {
  return <Editor />;
}
