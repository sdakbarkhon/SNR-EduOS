import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";
const db=makeServiceRoleClient(); const D=SCHOOL_ID;
const { data: plans } = await db.from("curriculum_plans").select("*").eq("school_id",D);
const { data: gs } = await db.from("groups").select("id,name"); const gN=new Map(gs.map(g=>[g.id,g.name.replace(" класс","")]));
const { data: ss } = await db.from("subjects").select("id,name,teacher_id"); const sN=new Map(ss.map(s=>[s.id,s.name]));
const { data: t1 } = await db.from("curriculum_plan_topics").select("*").limit(1);
console.log("колонки тем:", Object.keys(t1[0]).join(", "));
console.log("\nпример темы:", JSON.stringify(t1[0]));
const bad = plans.filter(p=>p.source_file_url);
const good = plans.filter(p=>!p.source_file_url);
console.log("\n── ЭТАЛОННЫЕ 12 ПЛАНОВ ──");
const g0=good[0];
for(const [k,v] of Object.entries(g0)) console.log(`  ${k} = ${JSON.stringify(v)}`.slice(0,110));
console.log("\nstatus у 12 целых:", JSON.stringify(good.reduce((a,p)=>((a[p.status??"null"]=(a[p.status??"null"]??0)+1),a),{})));
console.log("progress у 12 целых:", JSON.stringify(good.reduce((a,p)=>((a[p.progress_percent??"null"]=(a[p.progress_percent??"null"]??0)+1),a),{})));
console.log("teacher_id совпадает с subjects.teacher_id:", good.every(p=>p.teacher_id===ss.find(s=>s.id===p.subject_id)?.teacher_id));
console.log("\n── ТРИ ИСПОРЧЕННЫХ ──");
for(const p of bad){
  console.log(`\n${gN.get(p.group_id)} · ${sN.get(p.subject_id)}`);
  console.log(`  title = ${JSON.stringify(p.title)}`);
  console.log(`  status = ${JSON.stringify(p.status)} | progress = ${p.progress_percent} | file = ${String(p.source_file_url).slice(0,60)}`);
  console.log(`  teacher_id верный: ${p.teacher_id===ss.find(s=>s.id===p.subject_id)?.teacher_id}`);
  const { count } = await db.from("curriculum_plan_topics").select("id",{count:"exact",head:true}).eq("plan_id",p.id);
  console.log(`  тем: ${count}`);
}
// ссылаются ли уроки на темы испорченных планов
const { data: badTops } = await db.from("curriculum_plan_topics").select("id").in("plan_id",bad.map(p=>p.id));
const { count: refs } = await db.from("lessons").select("id",{count:"exact",head:true}).in("curriculum_topic_id",badTops.map(t=>t.id));
console.log(`\nуроков, ссылающихся на темы-из-книги: ${refs} (ожидание 0 — ссылки обнулились при замене)`);
// уроки без ссылки
const { data: ls } = await db.from("lessons").select("id,subject_id,group_id,title,curriculum_topic_id").eq("school_id",D)
  .gte("starts_at","2026-07-27T00:00:00+05:00").lt("starts_at","2026-08-03T00:00:00+05:00");
const noLink = ls.filter(l=>!l.curriculum_topic_id);
console.log(`уроков без ссылки на тему: ${noLink.length}`);
const byPair={}; for(const l of noLink){ const k=`${gN.get(l.group_id)} · ${sN.get(l.subject_id)}`; byPair[k]=(byPair[k]??0)+1; }
console.table(Object.entries(byPair).map(([k,v])=>({пара:k,уроков:v})));
