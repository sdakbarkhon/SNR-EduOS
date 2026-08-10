// Телефон родителя как ключ входа. Z.2.8, 09.08.2026.
//
// ЧТО БЫЛО ЗДЕСЬ РАНЬШЕ. Карта трёх тестовых номеров на трёх реальных
// родителей и общий пароль `parent2026` открытым текстом. Вход по такому
// номеру пускал внутрь кого угодно, кто знал девять цифр, а код из SMS не
// проверялся вовсе. Всё это удалено: телефон теперь живёт в базе
// (parents.phone NOT NULL + UNIQUE, миграция 180), а вход подтверждается
// одноразовым кодом.
//
// Здесь остаётся только нормализация — общая для админской формы и для
// экрана входа, чтобы «+998 90 123-45-67», «998901234567» и «901234567»
// сходились в одну строку и UNIQUE работал по смыслу, а не по написанию.

/** Канонический вид номера: +998XXXXXXXXX. */
export function normalizeUzPhone(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

/** Девять национальных цифр — формат, в котором номер вводят на экране
 *  входа и в мобильном приложении. */
export function nationalDigits(phone: string | null | undefined): string | null {
  const canonical = normalizeUzPhone(phone);
  return canonical ? canonical.slice(-9) : null;
}

/** Служебный адрес учётной записи родителя. Схема та же, что у остальных
 *  ролей: логин + домен роли. Логин — цифры номера со страной.
 *
 *  Применяется ТОЛЬКО к новым родителям. Существующие адреса (например
 *  parent_ismailov@parents.snr.local) не мигрируются: вход находит
 *  пользователя через parents.user_id, а не собирая адрес из номера. */
export function parentAuthEmail(phone: string): string {
  const canonical = normalizeUzPhone(phone);
  if (!canonical) throw new Error("Некорректный номер телефона");
  return `${canonical.slice(1)}@parents.snr.local`;
}
