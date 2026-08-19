// Server-side only. Карточка школы: поля организации и логотип.
//
// ОДНО МЕСТО НА ВСЁ. Здесь и правила проверки файла, и путь в хранилище, и
// выдача ссылки. Экраны (карточка суперадмина, шапка админки, профиль админа)
// зовут отсюда и своих копий правил не заводят.

import { createClient as createSbClient } from "@supabase/supabase-js";
import { schoolStoragePath } from "@snr/core";
import { changedFields, SCHOOL_CARD_FIELDS } from "@/lib/form-patch";

export const LOGO_BUCKET = "school-logos";

/** 2 МБ. Ровно столько же стоит на самом бакете (миграция 210) — здесь проверка
 *  ради понятного отказа, там же последний рубеж, который не обойти. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Растровые форматы. SVG не принимается намеренно: он может нести скрипт, а
 *  отдаётся файл с домена хранилища. Тот же список стоит на бакете. */
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Почему файл не подходит. Возвращается КОДОМ, а не готовой фразой: текст
 *  живёт в словарях на трёх языках, а сервер не знает язык вызывающего. */
export type LogoRejection =
  | { code: "too_big"; maxMb: number; gotMb: number }
  | { code: "bad_type"; got: string }
  | { code: "empty" };

export function checkLogoFile(file: { size: number; type: string }): LogoRejection | null {
  if (!file.size) return { code: "empty" };
  if (file.size > LOGO_MAX_BYTES) {
    return {
      code: "too_big",
      maxMb: LOGO_MAX_BYTES / 1024 / 1024,
      gotMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
    };
  }
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    // Пустой type — браузер не опознал файл. Для человека это то же самое, что
    // «не та картинка», отдельного случая заводить не за что.
    return { code: "bad_type", got: file.type || "?" };
  }
  return null;
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role env vars not set");
  return createSbClient(url, key, { auth: { persistSession: false } });
}

/** Загрузить логотип школы. Возвращает путь для schools.logo_path.
 *
 *  Путь строится schoolStoragePath — той же функцией, что и все остальные
 *  файлы школы, поэтому изоляция из миграции 188 накрывает логотип сама.
 *  Имя всегда `logo.<ext>`: у школы один логотип, и старый должен заменяться,
 *  а не копиться мусором рядом. */
export async function uploadSchoolLogo(schoolId: string, file: File): Promise<string> {
  const bad = checkLogoFile(file);
  if (bad) throw new Error(`LOGO_${bad.code.toUpperCase()}:${JSON.stringify(bad)}`);

  const sb = service();
  const ext = EXT_BY_MIME[file.type] ?? "png";
  const path = schoolStoragePath(schoolId, `logo.${ext}`);

  const { error } = await sb.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw new Error(`LOGO_UPLOAD_FAILED:${error.message}`);

  // Формат мог смениться (был png, стал webp) — тогда рядом остался бы файл
  // прежнего расширения и продолжал занимать место. Убираем все прочие.
  const others = Object.values(EXT_BY_MIME)
    .map((e) => schoolStoragePath(schoolId, `logo.${e}`))
    .filter((p) => p !== path);
  await sb.storage.from(LOGO_BUCKET).remove(others).catch(() => { /* нечего убирать */ });

  return path;
}

/** Убрать логотип школы. */
export async function removeSchoolLogo(schoolId: string): Promise<void> {
  const sb = service();
  const all = Object.values(EXT_BY_MIME).map((e) => schoolStoragePath(schoolId, `logo.${e}`));
  await sb.storage.from(LOGO_BUCKET).remove(all);
}

/** Ссылка на логотип — подписанная и на час.
 *
 *  Бакет закрытый, постоянной ссылки у файла нет вовсе. Час выбран под срок
 *  жизни страницы: экраны серверные и подписывают ссылку заново на каждый
 *  показ, так что дольше не нужно, а короче — риск, что вкладка провисела и
 *  логотип отвалился.
 *
 *  Подписывает служебный ключ. Это НЕ дыра в изоляции: вызов идёт с сервера,
 *  а кто чей логотип вправе увидеть, решают сами экраны — админ читает
 *  logo_path только из своей школы (её ему и отдаёт RLS на schools), а
 *  суперадминский экран по определению работает со всеми школами. */
export async function signLogoUrl(logoPath: string | null | undefined): Promise<string | null> {
  if (!logoPath) return null;
  const sb = service();
  const { data, error } = await sb.storage.from(LOGO_BUCKET).createSignedUrl(logoPath, 3600);
  if (error) {
    console.error("[school-card] не удалось подписать ссылку на логотип:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Поля карточки, приходящие из формы. Пустая строка превращается в null:
 *  иначе в базе копились бы пустые строки, неотличимые для человека от
 *  «не заполнено», но отличимые для кода. */
export type SchoolCardFields = {
  address: string | null;
  phone: string | null;
  email: string | null;
  director_name: string | null;
  website: string | null;
  legal_details: string | null;
};

/** Поля карточки, которые ЧЕЛОВЕК ПРАВДА МЕНЯЛ.
 *
 *  19.08.2026 — было иначе: возвращались все шесть, и очищенное поле уезжало
 *  в базу как NULL. То есть стёр адрес по невнимательности, нажал «Сохранить»
 *  — и прежний адрес пропал, ничего не спросив. Теперь колонка попадает в
 *  запрос, только если её значение отличается от того, с которым форму
 *  открыли; сравнение идёт по скрытым полям, их кладёт SchoolCardForm.
 *  Разбор приёма — lib/form-patch.ts.
 *
 *  При СОЗДАНИИ школы скрытых полей нет, сравнивать не с чем, и возвращаются
 *  все шесть — ровно как раньше.
 *
 *  Название и код школы сюда не входят и не входили: они обязательные,
 *  проверяются отдельно в actions.ts и пустыми не сохраняются вовсе. */
export function readCardFields(fd: FormData): Partial<SchoolCardFields> {
  return changedFields(fd, SCHOOL_CARD_FIELDS);
}
