import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PrismaClient,Prisma} from '@prisma/client';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const planPath=path.join(root,'working-approved-plan-1793255389620.json');
const bytes=fs.readFileSync(planPath),plan=JSON.parse(bytes),planHash=createHash('sha256').update(bytes).digest('hex');
const backup=path.resolve('backups/approved-2026-10-29T06-27-17-636Z');
const verified=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
const working=process.argv.includes('--approved-working');
if(!verified.databaseVerified||!verified.filesVerified)throw new Error('Backup restoration required');
const target=working?verified.source:verified.target;
const inspect=JSON.parse(execFileSync('docker',['inspect',target.container],{encoding:'utf8'}))[0];
const password=inspect.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const port=working?5432:55433;
if(working&&(target.database!=='lhl76_import_test'||target.container!=='senior-full-stack-76-wordpress-wordpress-postgres-1'))throw new Error('Wrong working target');
if(!working&&(!target.database.startsWith('approved_restore_')||inspect.Config.Labels?.['lhl76.purpose']!=='final-reconciliation'))throw new Error('Wrong rehearsal target');
if(working){const proof=JSON.parse(fs.readFileSync(path.join(root,'approved-application-rehearsal.json'),'utf8'));if(proof.planHash!==planHash||!proof.rollbackVerified||!proof.idempotent||!proof.originalIdsPreserved)throw new Error('Exact plan not verified');}
const db=new PrismaClient({datasourceUrl:`postgresql://${target.user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${target.database}`});
const modelMeta=new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name[0].toLowerCase()+m.name.slice(1),m]));
const quote=s=>{if(!/^\w+$/.test(s))throw new Error('Invalid identifier');return `"${s}"`;};
const table=model=>quote(modelMeta.get(model).dbName||modelMeta.get(model).name);
const normal=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(normal):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>k!=='updatedAt').map(k=>[k,normal(v[k])])):v;
const equal=(a,b)=>JSON.stringify(normal(a))===JSON.stringify(normal(b));
const order=['team','player','teamEntry','rosterEntry','match','matchRoster','goal','assist','penalty','legacyMatchEvent','legacyImportMap','teamStatistic','standing','playerStatistic'];
if(Object.keys(plan.models).some(m=>!order.includes(m)))throw new Error('Unapproved model');
async function verifyBaseline(tx){
 for(const r of verified.results){const rows=await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, coalesce(md5(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text)), 'empty') AS fingerprint FROM public.${quote(r.table)} t`);if(rows[0].count!==r.count||rows[0].fingerprint!==r.fingerprint)throw new Error(`Working baseline changed: ${r.table}`);}
}
async function apply(tx,{first=false,rollback=false}={}){
 await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
 await tx.$executeRawUnsafe(`LOCK TABLE ${verified.results.map(r=>'public.'+quote(r.table)).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
 if(first)await verifyBaseline(tx);
 const pending={},counts={};
 for(const model of order){const part=plan.models[model];if(!part)continue;const current=new Map((await tx[model].findMany()).map(r=>[r.id,r]));const create=[],update=[];
  for(const row of part.create){const old=current.get(row.id);if(!old)create.push(row);else if(!equal(old,row))throw new Error(`Created row changed: ${model}`);}
  for(const item of part.update){const old=current.get(item.id);if(!old)throw new Error('Missing original row');if(item.fields.every(k=>equal(old[k],item.after[k])))continue;if(!item.fields.every(k=>equal(old[k],item.before[k])))throw new Error(`Field changed: ${model}`);update.push(item);}
  pending[model]={create,update};counts[model]={created:create.length,updated:update.length};
 }
 // Free only ranks being changed, within the same transaction.
 const ranks=pending.standing.update.filter(r=>r.fields.includes('rank'));
 for(let i=0;i<ranks.length;i++)await tx.standing.update({where:{id:ranks[i].id},data:{rank:-900000-i}});
 for(const model of order){const {create,update}=pending[model];
  for(let offset=0;offset<create.length;offset+=400){const batch=create.slice(offset,offset+400),cols=Object.keys(batch[0]);if(batch.some(r=>Object.keys(r).join()!==cols.join()))throw new Error('Inconsistent row shape');const names=cols.map(quote).join(',');await tx.$executeRawUnsafe(`INSERT INTO ${table(model)} (${names}) SELECT ${names} FROM jsonb_populate_recordset(NULL::${table(model)}, $1::jsonb)`,JSON.stringify(batch));}
  const groups=new Map();for(const row of update){const key=[...row.fields].sort().join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  for(const [key,rows] of groups){const fields=key.split(','),assignments=fields.map(k=>`${quote(k)}=v.${quote(k)}`).join(',');for(let offset=0;offset<rows.length;offset+=400){const batch=rows.slice(offset,offset+400).map(r=>({id:r.id,...Object.fromEntries(fields.map(k=>[k,r.after[k]]))}));const count=await tx.$executeRawUnsafe(`UPDATE ${table(model)} t SET ${assignments} FROM jsonb_populate_recordset(NULL::${table(model)}, $1::jsonb) v WHERE t.id=v.id`,JSON.stringify(batch));if(count!==batch.length)throw new Error('Update count mismatch');}}
 }
 await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
 const baseline=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8'));
 for(const [model,rows] of Object.entries(baseline)){const ids=new Set((await tx[model].findMany({select:{id:true}})).map(r=>r.id));if(rows.some(r=>!ids.has(r.id)))throw new Error('Original ID lost');}
 if(rollback)throw new Error('EXPECTED_APPROVED_ROLLBACK');return counts;
}
try{
 let rollbackVerified=false;
 if(!working){try{await db.$transaction(tx=>apply(tx,{first:true,rollback:true}),{timeout:240000});}catch(e){if(e.message!=='EXPECTED_APPROVED_ROLLBACK')throw e;rollbackVerified=true;}await db.$transaction(tx=>verifyBaseline(tx),{timeout:120000});}
 const first=await db.$transaction(tx=>apply(tx,{first:true}),{timeout:240000});
 const second=await db.$transaction(tx=>apply(tx),{timeout:240000});
 const report={checkedAt:new Date().toISOString(),planHash,target:{database:target.database,port},first,second,rollbackVerified:working?true:rollbackVerified,idempotent:Object.values(second).every(c=>c.created===0&&c.updated===0),originalIdsPreserved:true,workingWrites:working,backup,heldProtocols:plan.heldProtocolMatchIds};
 fs.writeFileSync(path.join(root,working?'approved-working-import.json':'approved-application-rehearsal.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect();}
