import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";
const db=makeServiceRoleClient(); const D=SCHOOL_ID;
const { data: plans } = await db.from("curriculum_plans").select("*").eq("school_id",D);
const { data: gs } = await db.from("groups").select("id,name"); const gN=new Map(gs.map(g=>[g.id,g.name.replace(" класс","")]));
const { data: ss } = await db.from("subjects").select("id,name"); const sN=new Map(ss.map(s=>[s.id,s.name]));
const { data: tops } = await db.from("curriculum_plan_topics").select("id,plan_id,order_index,title").in("plan_id",plans.map(p=>p.id));
console.log("колонки curriculum_plans:", Object.keys(plans[0]).join(", "));
console.log("\nвсе планы:");
console.table(plans.map(p=>({группа:gN.get(p.group_id),предмет:sN.get(p.subject_id),тем:tops.filter(t=>t.plan_id===p.id).length,
  название:String(p.title).slice(0,40), файл:p.source_file_url?"ЕСТЬ":"—", тип:p.source_file_type??"—"})).sort((a,b)=>a.группа.localeCompare(b.группа)));
console.log("\nколонки curriculum_plan_topics:", Object.keys(tops[0]).join(", "));
