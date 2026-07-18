"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "../LocaleProvider";

// Часть 3 — эмодзи в чатах. Своя лёгкая панель без тяжёлых библиотек
// (emoji-mart и т.п.), ~56 популярных юникод-эмодзи. Эмодзи языконезависимы,
// отдельного i18n-набора не требуют — переводится только заголовок/title.
const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🙂", "😊", "😉", "😍",
  "🥰", "😘", "😋", "😜", "🤔", "🙄", "😏", "😴", "😢", "😭",
  "😡", "😱", "🥳", "😎", "🤗", "😐", "🤩", "😬", "🤪", "😇",
  "👍", "👎", "👏", "🙏", "💪", "👋", "✌️", "🤞", "👌", "🤝",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔",
  "💯", "🔥", "⭐", "✨", "🎉", "🎊", "✅", "❌",
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        title={d.chat.emojiPicker}
        aria-label={d.chat.emojiPicker}
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 grid w-[248px] grid-cols-8 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-lg transition hover:bg-gray-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
