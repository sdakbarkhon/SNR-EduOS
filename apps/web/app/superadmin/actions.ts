"use server";

import {
  createSchoolAdmin, changeOwnPassword, createSchool, updateSchoolCard,
  updateSchoolAdmin, deleteSchoolAdmin, resetSchoolAdminPassword,
  assertSchoolIsManageable, assertAdminIsManageable,
} from "@/lib/admin-api";
import {
  deleteSchoolForever, getSchoolWipePreview, setSchoolArchived,
  type SchoolWipePreview, type WipeResult,
} from "@/lib/school-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readCardFields, removeSchoolLogo, uploadSchoolLogo,
} from "@/lib/school-card";
import { changedFields, ADMIN_GUARDED_FIELDS } from "@/lib/form-patch";
import { parseLessonDuration, isValidLessonDuration } from "@snr/core";
import { withJournal, journalAccessDenied, journalSchoolVisit } from "@/lib/superadmin-journal";
import { guard, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Кто перед нами — и единственное место, где отказ по роли попадает в журнал.
 *
 * Все десять изменяющих действий начинаются отсюда, поэтому и врезка одна.
 * Имя берём здесь же: в журнале оно хранится СНИМКОМ на момент действия, и
 * переименование суперадмина прошлых записей не перепишет.
 *
 * Незалогиненных в журнал не пишем намеренно: это не «попытка не того
 * человека», а запрос без сессии, и писать их значило бы отдать журнал во
 * власть того, кто дёргает адрес в цикле.
 */
async function verifySuperAdmin(): Promise<{ id: string; name: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: superAdmin } = await (sb as any)
    .from("super_admins").select("id, full_name").eq("user_id", user.id).single();
  if (!superAdmin) {
    await journalAccessDenied(user.id, "superadmin");
    throw new Error("Not super admin");
  }
  return { id: user.id, name: (superAdmin.full_name as string) ?? "" };
}

/** Название школы для журнала: после удаления взять его будет негде, а искать
 *  человек будет именно по названию. Молчит при любой беде — журнал не должен
 *  ронять действие из-за того, что не смог подписать строку красиво. */
async function schoolNameFor(schoolId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createAdminClient() as any)
      .from("schools").select("name").eq("id", schoolId).maybeSingle();
    return (data?.name as string) ?? null;
  } catch { return null; }
}

/** Имя, код и автостарт школы ДО правки — чтобы в журнале осталось «было →
 *  стало» по тем полям, которые правда изменились. */
async function schoolBasicsFor(schoolId: string): Promise<Record<string, unknown> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createAdminClient() as any)
      .from("schools").select("name, code, autostart_enabled, lesson_duration_minutes").eq("id", schoolId).maybeSingle();
    return (data as Record<string, unknown>) ?? null;
  } catch { return null; }
}

/** То же для администратора школы: принимает admins.user_id или admins.id. */
async function adminNameFor(ref: { userId?: string; adminId?: string }): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (createAdminClient() as any).from("admins").select("full_name");
    const { data } = await (ref.userId ? q.eq("user_id", ref.userId) : q.eq("id", ref.adminId)).maybeSingle();
    return (data?.full_name as string) ?? null;
  } catch { return null; }
}

/**
 * Длительность урока из формы карточки школы. Миграция 246.
 *
 * Три исхода, и путать их нельзя:
 *   • поле пустое → `undefined`, колонка в запрос НЕ попадает и прежнее
 *     значение остаётся. Это тот же приём, что у полей карточки
 *     (lib/form-patch.ts): стёр по невнимательности — не потерял;
 *   • число вне границ или не число → бросаем с готовым текстом. Молча
 *     подставить 45 нельзя: человек напечатал 450, имея в виду 45, и обязан
 *     об этом узнать;
 *   • годное число → оно.
 *
 * Границы берутся из общего слоя, те же, что в ограничении схемы.
 */
function readLessonDuration(formData: FormData): number | undefined {
  const parsed = parseLessonDuration(formData.get("lesson_duration_minutes") as string | null);
  if (parsed === null) return undefined;
  if (!isValidLessonDuration(parsed)) throw new Error("LESSON_DURATION_OUT_OF_RANGE");
  return parsed;
}

// ── SCHOOLS ──────────────────────────────────────────────────────────────────

export async function actionCreateSchool(formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const autostart_enabled = formData.get("autostart_enabled") === "on";
    const lesson_duration_minutes = readLessonDuration(formData);
    if (!name || !code) throw new Error("Missing fields");
    // Номер школы до создания не существует, поэтому в строке «начато» его нет.
    // Он появляется во второй строке, «завершено», — ради него она тут и есть.
    const id = await withJournal(
      {
        action: "school.create", actorUserId: actor.id, actorName: actor.name,
        targetType: "school", targetName: name,
        details: { name, code, autostart_enabled, lesson_duration_minutes },
      },
      () => createSchool({ name, code, autostart_enabled, lesson_duration_minutes }),
      (newId) => ({ targetId: newId, details: { name, code } }),
    );

    // Карточка заполняется тем же действием, что и создание: заводить школу, а
    // потом отдельно открывать её на правку ради адреса — лишний шаг на ровном
    // месте. Логотип грузится ПОСЛЕ создания, потому что путь к файлу содержит
    // идентификатор школы, а до вставки его не существует.
    await saveSchoolCard(id, formData);

    revalidatePath("/superadmin/schools");
    revalidatePath("/superadmin/dashboard");
    return id;
  });
}

/** Общая часть создания и правки: поля организации плюс логотип.
 *
 *  Логотип пишется ПЕРЕД обновлением строки, а путь сохраняется только после
 *  успешной загрузки. Иначе в logo_path оказалась бы ссылка на файл, которого
 *  нет, и экраны показывали бы битую картинку вместо честного «логотипа нет».
 */
async function saveSchoolCard(schoolId: string, formData: FormData): Promise<void> {
  const fields = readCardFields(formData);
  const patch: Record<string, unknown> = { ...fields };

  const file = formData.get("logo");
  const hasFile = file instanceof File && file.size > 0;

  if (formData.get("logo_remove") === "on") {
    await removeSchoolLogo(schoolId);
    patch.logo_path = null;
  } else if (hasFile) {
    patch.logo_path = await uploadSchoolLogo(schoolId, file as File);
  }

  await updateSchoolCard(schoolId, patch);
}

/** Правка карточки существующей школы. */
export async function actionUpdateSchool(schoolId: string, formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    await assertSchoolIsManageable(schoolId);

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    if (!name || !code) throw new Error("Missing fields");
    const autostart_enabled = formData.get("autostart_enabled") === "on";
    const lesson_duration_minutes = readLessonDuration(formData);

    // «Было → стало» — ТОЛЬКО по изменившимся полям. Копия строки целиком
    // раздула бы журнал и натащила бы в него лишнее. Поля карточки собирает
    // readCardFields, и он сам отдаёт лишь те, которые человек правда правил
    // (lib/form-patch.ts), поэтому здесь сравниваем только имя, код и автостарт.
    const before = await schoolBasicsFor(schoolId);
    const after: Record<string, unknown> = { name, code, autostart_enabled };
    // Пустое поле означает «не менял» — тогда его нет ни в запросе, ни в
    // журнале «было → стало».
    if (lesson_duration_minutes !== undefined) after.lesson_duration_minutes = lesson_duration_minutes;
    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(after)) {
      if (before && before[k] !== after[k]) diff[k] = { before: before[k], after: after[k] };
    }
    const cardKeys = Object.keys(readCardFields(formData));
    const logo = formData.get("logo_remove") === "on" ? "removed"
      : (formData.get("logo") instanceof File && (formData.get("logo") as File).size > 0) ? "replaced"
      : null;

    await withJournal(
      {
        action: "school.update", actorUserId: actor.id, actorName: actor.name,
        targetType: "school", targetId: schoolId,
        targetName: (before?.name as string | undefined) ?? name,
        details: { changed: diff, cardFields: cardKeys, logo },
      },
      async () => {
        await updateSchoolCard(schoolId, { name, code, autostart_enabled, ...(lesson_duration_minutes !== undefined ? { lesson_duration_minutes } : {}) });
        await saveSchoolCard(schoolId, formData);
      },
    );

    revalidatePath("/superadmin/schools");
    revalidatePath("/admin");
    revalidatePath("/admin/profile");
  });
}

/**
 * Что уйдёт при удалении школы. Показывается в диалоге до подтверждения.
 * Доступно только суперадмину: админ школы своей школы удалить не может.
 */
export async function actionSchoolWipePreview(schoolId: string): Promise<ActionResult<SchoolWipePreview | null>> {
  return guard(async () => {
    // В ЖУРНАЛ НЕ ПИШЕТСЯ НАМЕРЕННО: это единственная из четырнадцати кнопок,
    // которая ничего не меняет — она лишь показывает, что уйдёт. Записывать
    // просмотры значило бы утопить настоящие действия в шуме.
    await verifySuperAdmin();
    return getSchoolWipePreview(schoolId);
  });
}

/** Архивировать школу или вернуть из архива. Обратимо. */
export async function actionSetSchoolArchived(schoolId: string, archived: boolean) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    await assertSchoolIsManageable(schoolId);
    await withJournal(
      {
        action: "school.archive", actorUserId: actor.id, actorName: actor.name,
        targetType: "school", targetId: schoolId, targetName: await schoolNameFor(schoolId),
        details: { archived },
      },
      () => setSchoolArchived(schoolId, archived),
    );
    revalidatePath("/superadmin/schools");
    revalidatePath("/superadmin/dashboard");
  });
}

/**
 * Удалить школу насовсем.
 *
 * Подтверждение — НАЗВАНИЕ школы, набранное вручную. Слово «УДАЛИТЬ» набирается
 * механически и одинаково для любой строки списка; название заставляет
 * посмотреть, ту ли школу удаляешь. Сверка идёт ЗДЕСЬ, на сервере: проверка
 * только в форме обходится вызовом действия напрямую.
 */
export async function actionDeleteSchoolForever(
  schoolId: string,
  confirmation: string,
): Promise<ActionResult<WipeResult>> {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    await assertSchoolIsManageable(schoolId);

    const preview = await getSchoolWipePreview(schoolId);
    if (!preview) throw new Error("Школа не найдена");

    // ОДНА запись на всё удаление, а не 59 по числу связей: журнал про решения
    // человека, а не про строки в базе. В неё кладём ровно ту сводку, которую
    // человек видел перед тем, как набрать название и подтвердить, — а итог
    // (сколько файлов и учёток ушло) приходит второй строкой, «завершено»,
    // потому что до действия его знать неоткуда.
    //
    // Отказы демо-школы и несовпадения названия проверяются ВНУТРИ обёртки —
    // иначе они не попали бы в журнал, а это самые интересные строки.
    const detail = {
      preview: {
        name: preview.name,
        ...Object.fromEntries(
          Object.entries(preview as unknown as Record<string, unknown>)
            .filter(([k, v]) => k !== "name" && (typeof v === "number" || typeof v === "boolean")),
        ),
      },
    };

    const result = await withJournal(
      {
        action: "school.delete", actorUserId: actor.id, actorName: actor.name,
        targetType: "school", targetId: schoolId, targetName: preview.name,
        details: detail,
      },
      async () => {
        if (preview.isDemo) throw new Error("demo_school_cannot_be_deleted");
        if (confirmation.trim() !== preview.name.trim()) throw new Error("school_name_mismatch");
        return deleteSchoolForever(schoolId);
      },
      (r) => ({ details: { files: r.files, users: r.users } }),
    );

    revalidatePath("/superadmin/schools");
    revalidatePath("/superadmin/dashboard");
    return result;
  });
}

/**
 * Войти в школу на просмотр.
 *
 * ЧТО ЭТО ДЕЛАЕТ И ЧЕГО НЕ ДЕЛАЕТ. Записывает вход в журнал и переводит на
 * экраны просмотра. Никаких прав человеку не выдаёт и ничего в базе не
 * меняет: «где я сейчас» будет написано в адресе, а не в куке и не в строке
 * какой-нибудь таблицы. Поэтому закрытая вкладка не оставляет за собой
 * ничего, а две вкладки с разными школами не путаются между собой.
 *
 * ЗАПИСЬ НЕ ОТМЕНЯЕТ ВХОД — единственное отступление от правила «не легло,
 * значит не делаем». Правило защищает от бесследных ИЗМЕНЕНИЙ, а здесь
 * человек ничего не меняет. Запереть просмотр из-за несработавшей строки
 * значило бы обменять работающий надзор на молчащий журнал.
 */
/**
 * НЕ обёрнут в guard() намеренно, в отличие от остальных одиннадцати.
 * Это действие висит прямо на <form action=…>: возвращаемое значение никто
 * не читает, и обёртка превратила бы сбой в молчаливое бездействие — человек
 * нажал бы «Войти» и остался на месте без единого слова. Отказ здесь должен
 * оставаться броском: его показывает граница ошибок Next.
 */
export async function actionEnterSchool(schoolId: string) {
  const actor = await verifySuperAdmin();
  await journalSchoolVisit(actor, { id: schoolId, name: await schoolNameFor(schoolId) });
  redirect(`/superadmin/schools/${schoolId}/view`);
}

// ── SCHOOL ADMINS ────────────────────────────────────────────────────────────

export async function actionCreateSchoolAdmin(formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    const full_name = String(formData.get("full_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const school_id = String(formData.get("school_id") ?? "").trim();
    if (!full_name || !username || !password || !school_id) throw new Error("Missing fields");
    // Z.1: school_id приходит из FormData — фильтр в <select> ничего не гарантирует.
    await assertSchoolIsManageable(school_id);
    const google_email = String(formData.get("google_email") ?? "").trim() || null;

    // ПАРОЛЬ В ЖУРНАЛ НЕ ПОПАДАЕТ. Здесь перечислены поля поимённо, и его среди
    // них нет; вторым рубежом стоит проверка в самой базе, которая отвергла бы
    // запись с таким ключом (journal_assert_no_secrets, миграция 220).
    const result = await withJournal(
      {
        action: "admin.create", actorUserId: actor.id, actorName: actor.name,
        targetType: "admin", targetName: full_name,
        details: { full_name, username, school_id, google_email },
      },
      () => createSchoolAdmin({ full_name, username, password, school_id, google_email }),
      (r) => ({ targetId: r.adminId }),
    );
    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin/dashboard");
    return result;
  });
}

export async function actionUpdateSchoolAdmin(formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    const admin_id = String(formData.get("admin_id") ?? "").trim();
    const full_name = String(formData.get("full_name") ?? "").trim();
    const school_id = String(formData.get("school_id") ?? "").trim();
    if (!admin_id || !full_name || !school_id) throw new Error("Missing fields");
    // Z.1: проверяем ОБА конца — нельзя ни тронуть демо-админа, ни перенести
    // кого-либо В демо-школу.
    await assertAdminIsManageable({ adminId: admin_id });
    await assertSchoolIsManageable(school_id);
    // Почта пишется, ТОЛЬКО если её правда меняли. Разбор — lib/form-patch.ts.
    // Раньше здесь пустая строка превращалась в null и уезжала в базу поверх
    // заполненной почты при каждом сохранении.
    const changed = changedFields(formData, ADMIN_GUARDED_FIELDS);
    await withJournal(
      {
        action: "admin.update", actorUserId: actor.id, actorName: actor.name,
        targetType: "admin", targetId: admin_id,
        targetName: await adminNameFor({ adminId: admin_id }),
        // В журнал уходит ФАКТ смены почты, а не сама почта: её меняли или нет —
        // сведение о действии, а адрес человека в журнале не нужен.
        details: { full_name, school_id, googleEmailChanged: "google_email" in changed },
      },
      () => updateSchoolAdmin(admin_id, { full_name, school_id, ...changed }),
    );
    revalidatePath("/superadmin/admins");
  });
}

export async function actionDeleteSchoolAdmin(userId: string) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    // Z.1: hard delete через auth.admin.deleteUser — без этой проверки crafted
    // POST сносит демо-админа (admin/admin123) вместе с auth-пользователем.
    await assertAdminIsManageable({ userId });
    await withJournal(
      {
        action: "admin.delete", actorUserId: actor.id, actorName: actor.name,
        targetType: "admin", targetId: userId,
        targetName: await adminNameFor({ userId }),
      },
      () => deleteSchoolAdmin(userId),
    );
    revalidatePath("/superadmin/admins");
    revalidatePath("/superadmin/dashboard");
  });
}

export async function actionResetSchoolAdminPassword(userId: string) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    // Z.1: иначе можно молча сменить пароль демо-админу.
    await assertAdminIsManageable({ userId });
    // В журнал уходит ТОЛЬКО факт: кому и когда сбросили. Ни нового пароля, ни
    // его части, ни длины — в подробностях нет ничего, кроме имени.
    const newPassword = await withJournal(
      {
        action: "admin.reset_password", actorUserId: actor.id, actorName: actor.name,
        targetType: "admin", targetId: userId,
        targetName: await adminNameFor({ userId }),
      },
      () => resetSchoolAdminPassword(userId),
    );
    revalidatePath("/superadmin/admins");
    return newPassword;
  });
}

/**
 * Почта Google самому суперадминистратору (миграция 214).
 *
 * Пишет он себе сам — ролей выше него нет, и просить кого-то другого вписать
 * ему адрес некого. Уникальность по всем пяти ролям держит база: тот же
 * триггер, что у остальных.
 */
export async function actionSetOwnGoogleEmail(formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    const raw = String(formData.get("google_email") ?? "").trim().toLowerCase();
    const value = raw === "" ? null : raw;

    await withJournal(
      {
        action: "self.google_email", actorUserId: actor.id, actorName: actor.name,
        targetType: "self", targetId: actor.id, targetName: actor.name,
        // Факт, а не адрес: вписал или стёр. Сам адрес в журнале не нужен.
        details: { set: value !== null },
      },
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (createAdminClient() as any)
          .from("super_admins")
          .update({ google_email: value })
          .eq("user_id", actor.id);
        if (error) throw error;
      },
    );
    revalidatePath("/superadmin/settings");
  });
}

export async function actionChangeOwnPassword(formData: FormData) {
  return guard(async () => {
    const actor = await verifySuperAdmin();
    const newPassword = String(formData.get("new_password") ?? "").trim();
    if (!newPassword || newPassword.length < 6) throw new Error("Password too short");
    // Подробностей нет вовсе — записывается только сам факт смены.
    await withJournal(
      {
        action: "self.password", actorUserId: actor.id, actorName: actor.name,
        targetType: "self", targetId: actor.id, targetName: actor.name,
      },
      () => changeOwnPassword(actor.id, newPassword),
    );
  });
}
