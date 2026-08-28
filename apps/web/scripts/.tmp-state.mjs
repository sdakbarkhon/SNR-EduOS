import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";
const db=makeServiceRoleClient(); const D=SCHOOL_ID;
const { data: plans } = await db.from("curriculum_plans").select("*").eq("school_id",D);
const { data: gs } = await db.from("groups").select("id,name"); const gN=new Map(gs.map(g=>[g.id,g.name]));
const { data: ss } = await db.from("subjects").select("id,name"); const sN=new Map(ss.map(s=>[s.id,s.name]));
const { data: tops } = await db.from("curriculum_plan_topics").select("id,plan_id,title").in("plan_id",plans.map(p=>p.id));
console.log("планы (тем / файл / заголовок):");
for(const p of plans.sort((a,b)=>String(gN.get(a.group_id)).localeCompare(String(gN.get(b.group_id)))))
  console.log(`  ${String(tops.filter(t=>t.plan_id===p.id).length).padStart(2)} тем  ${p.source_file_url?"[файл]":"[   ]"}  ${p.title}`);
const { data: ls } = await db.from("lessons").select("id,curriculum_topic_id,group_id,subject_id,title").eq("school_id",D)
  .gte("starts_at","2026-07-27T00:00:00+05:00").lt("starts_at","2026-08-03T00:00:00+05:00");
console.log("\nуроков без ссылки:", ls.filter(l=>!l.curriculum_topic_id).length);
const byPair={}; for(const l of ls.filter(l=>!l.curriculum_topic_id)){const k=`${gN.get(l.group_id)} · ${sN.get(l.subject_id)}`; byPair[k]=(byPair[k]??0)+1;}
console.log(JSON.stringify(byPair,null,1));
console.log("всего тем:", tops.length);
