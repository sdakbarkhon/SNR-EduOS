"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Блок «Вход через Google» для форм админки и суперадминки.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ. Поле почты стояло в четырёх формах — ученик,
 * учитель, администратор, родитель, — и в трёх из них это было просто поле без
 * единого слова о том, зачем оно. Человек, заполняющий карточку ученика, не
 * обязан догадываться, что «Почта Google» это способ входа, а не адрес для
 * писем. У родителя объяснение было, у остальных нет — теперь у всех одинаково
 * и в одном месте, чтобы через месяц они снова не разошлись.
 *
 * ПОЧЕМУ ОБЪЯСНЕНИЕ ИМЕННО ТАКОЕ. Три вещи, которые администратор должен знать
 * до того, как впишет адрес: поле необязательное, вписанная почта заменяет
 * логин с паролем, и одна почта принадлежит одному человеку. Последнее важнее
 * всего: иначе адрес семьи впишут двоим детям, и база откажет уже на
 * сохранении — лучше сказать заранее.
 */
export function GoogleEmailField({
  name = "google_email",
  defaultValue,
  placeholder = "ivan@gmail.com",
  id,
}: {
  name?: string;
  defaultValue?: string | null;
  placeholder?: string;
  id?: string;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).admin;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t.googleBlockTitle}</p>
      <input
        id={id}
        name={name}
        type="email"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        autoCapitalize="none"
        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
      />
      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">{t.googleBlockHint}</p>
    </div>
  );
}
