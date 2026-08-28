import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";
const db=makeServiceRoleClient(); const D=SCHOOL_ID;
const { data: plans } = await db.from("curriculum_plans").select("id,title,group_id,subject_id").eq("school_id",D);
const { data: gs } = await db.from("groups").select("id,name"); const gN=new Map(gs.map(g=>[g.id,g.name]));
const p = plans.find(x=>x.title==="Программирование — 10-А класс");
const { data: t } = await db.from("curriculum_plan_topics").select("order_index,title").eq("plan_id",p.id).order("order_index");
console.log("10-А Программирование, текущие 24 темы:");
for(const x of t) console.log(`  ${String(x.order_index).padStart(2)}: ${x.title}`);
