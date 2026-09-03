// РАЗОВОЕ ЗАПОЛНЕНИЕ subject_slug УЧИТЕЛЯМ БЕЗ КАФЕДРЫ. 04.09.2026.
//
// Повторяет ensureSubjectSlug буква в букву: слаг берётся из ТОГО ЖЕ словаря
// по ТОЧНОМУ названию предмета, пишется ТОЛЬКО поверх пустого и ТОЛЬКО в
// реальных школах. Своего правила здесь нет — иначе разойдётся.
//
// По умолчанию ХОЛОСТОЙ ПРОГОН. Запись — только с доводом --write.
import { createClient } from "@supabase/supabase-js";
import { getSubjectKeyByLabel } from "@snr/core";

const писать = process.argv.includes("--write");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: schools } = await db.from("schools").select("id, name, is_demo");
const школа = Object.fromEntries((schools ?? []).map((s) => [s.id, s]));

const { data: teachers } = await db.from("teachers").select("id, full_name, school_id, subject_slug");
const { data: subjects } = await db
  .from("subjects").select("teacher_id, name, is_stub, is_active")
  .eq("is_stub", false).eq("is_active", true);

const план = [];
for (const t of teachers ?? []) {
  if (t.subject_slug) continue;                       // поверх заполненного не пишем
  const s = школа[t.school_id];
  if (!s || s.is_demo) continue;                      // демо-школа живёт своим сидом
  const мои = (subjects ?? []).filter((x) => x.teacher_id === t.id);
  const названия = [...new Set(мои.map((x) => x.name))];
  const слаги = [...new Set(названия.map(getSubjectKeyByLabel).filter(Boolean))];
  план.push({
    учитель: t.full_name, id: t.id, школа: s.name,
    предметы: названия.join(", ") || "(назначений нет)",
    слаг: слаги.length === 1 ? слаги[0] : слаги.length === 0 ? null : "НЕОДНОЗНАЧНО: " + слаги.join("/"),
  });
}

console.log(`\n${писать ? "ЗАПИСЬ" : "ХОЛОСТОЙ ПРОГОН"} — учителей без слага: ${план.length}\n`);
for (const p of план) {
  console.log(`  ${p.учитель}  (${p.школа})`);
  console.log(`      предмет: ${p.предметы}`);
  console.log(`      слаг:    ${p.слаг ?? "НЕТ В СПРАВОЧНИКЕ — пропускаем"}`);
}

const кПисьму = план.filter((p) => p.слаг && !p.слаг.startsWith("НЕОДНОЗНАЧНО"));
console.log(`\nпроставится: ${кПисьму.length}, пропустим: ${план.length - кПисьму.length}`);

if (!писать) {
  console.log("\nЗаписи не было. Для записи: тот же вызов с --write\n");
  process.exit(0);
}

let записано = 0;
for (const p of кПисьму) {
  const { error } = await db.from("teachers").update({ subject_slug: p.слаг }).eq("id", p.id).is("subject_slug", null);
  if (error) { console.log(`  ✗ ${p.учитель}: ${error.message}`); continue; }
  записано++;
  console.log(`  ✓ ${p.учитель} → ${p.слаг}`);
}
console.log(`\nзаписано строк: ${записано}`);

const { data: после } = await db.from("teachers").select("full_name, subject_slug");
const без = (после ?? []).filter((t) => !t.subject_slug);
console.log(`после записи учителей без слага: ${без.length}${без.length ? " — " + без.map((t) => t.full_name).join(", ") : ""}`);
