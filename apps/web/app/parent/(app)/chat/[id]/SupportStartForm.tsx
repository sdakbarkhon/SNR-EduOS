"use client";

/**
 * Начало переписки с поддержкой из веба.
 *
 * Комната заводится ПЕРВЫМ СООБЩЕНИЕМ, а не открытием экрана — тот же порядок,
 * что в мобильном приложении, и по той же причине: иначе у каждого, кто просто
 * заглянул, появилась бы пустая комната, а список обращений у админа забился
 * бы пустышками.
 *
 * Подписи берутся из общего словаря теми же ключами, которыми подписан экран
 * поддержки в мобильном: два одинаковых литерала в разных приложениях однажды
 * разойдутся. Язык здесь настоящий, а не прибитый: компонент клиентский и
 * знает выбранный язык (в отличие от серверного _ui/threads.ts).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { EmptyState } from "../../_ui/screen-kit";
import { ICON } from "../../_ui/screen-tokens";
import { unwrap } from "@/lib/action-result";
import { startParentSupportChat } from "./actions";
import { accentGrad, ink1, ink2, ink3 } from "../../v2/tokens";

export function SupportStartForm() {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).parentApp.msg;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [ошибка, setОшибка] = useState<{ title: string; text: string } | null>(null);

  const отправить = () => {
    const текст = body.trim();
    if (!текст || isPending) return;
    setОшибка(null);
    startTransition(async () => {
      try {
        const { threadId } = await unwrap(startParentSupportChat(текст));
        setBody("");
        // Только replace, без router.refresh() следом. Два вызова подряд
        // гоняются: refresh обновляет ТЕКУЩИЙ маршрут и успевает отменить
        // запланированный переход — прогон поймал это живьём, сообщение
        // уходило в базу, а экран оставался на пустом состоянии. Целевой
        // маршрут и так рисуется заново: действие пометило его устаревшим
        // через revalidatePath.
        router.replace(`/parent/chat/${threadId}`);
      } catch (e) {
        // Код отказа приходит от действия; фразу подставляем здесь, на языке
        // родителя. «Отвечать некому» — не сбой, а состояние школы, поэтому у
        // него свой текст, а не общее «не отправлено».
        const код = (e as { message?: string })?.message ?? "";
        setОшибка(
          код.includes("SUPPORT_NO_ADMIN")
            ? { title: t.supportNoAdminTitle, text: t.supportNoAdminText }
            : { title: t.supportSendFailed, text: "" },
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <EmptyState title={t.supportStartTitle} text={t.supportStartText} paths={ICON.help} />

      {ошибка ? (
        <div
          className="rounded-[14px] px-3 py-2.5"
          style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.28)" }}
        >
          <div className="text-[11.5px] font-extrabold" style={{ color: "#9F1239" }}>{ошибка.title}</div>
          {ошибка.text ? (
            <div className="mt-0.5 text-[10px] font-semibold leading-[1.5]" style={{ color: ink2 }}>
              {ошибка.text}
            </div>
          ) : null}
        </div>
      ) : null}

      <form
        onSubmit={(e) => { e.preventDefault(); отправить(); }}
        className="flex items-center gap-2"
      >
        <input
          name="support_first_message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.typeMessage}
          className="h-10 min-w-0 flex-1 rounded-full px-4 text-[12px] font-semibold outline-none"
          style={{ background: "rgba(255,255,255,0.62)", border: "1px solid rgba(255,255,255,0.8)", color: ink1 }}
        />
        <button
          type="submit"
          data-support-start
          disabled={isPending || !body.trim()}
          className="h-10 shrink-0 rounded-full px-4 text-[12px] font-extrabold text-white transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: accentGrad, boxShadow: "0 6px 14px rgba(124,58,237,0.35)" }}
        >
          {t.supportSendBtn}
        </button>
      </form>

      <p className="px-1 text-[9.5px] font-semibold" style={{ color: ink3 }}>
        {t.supportRealSub}
      </p>
    </div>
  );
}
