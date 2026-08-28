import { makeServiceRoleClient, SCHOOL_ID } from "./_backfill-shared.mjs";
const db=makeServiceRoleClient(); const D=SCHOOL_ID;
const { data: plans } = await db.from("curriculum_plans").select("id,title,created_at,teacher_id,source_file_url").eq("school_id",D).order("created_at");
const { data: ts } = await db.from("teachers").select("id,full_name"); const tN=new Map(ts.map(t=>[t.id,t.full_name]));
console.log("планы по времени создания:");
for(const p of plans) console.log(`  ${p.created_at.slice(0,16).replace("T"," ")}  ${p.source_file_url?"[файл]":"[скрипт]"}  ${tN.get(p.teacher_id)??"—"}  ${p.title}`);
