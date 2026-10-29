import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const original=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8'));
const v=JSON.parse(fs.readFileSync('backups/safety-20261029-084745-779/clean-rehearsal/complete-verification.json','utf8'));
const config=JSON.parse(execFileSync('docker',['inspect',v.target.container],{encoding:'utf8'}))[0];
const password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const db=new PrismaClient({datasourceUrl:`postgresql://${v.target.user}:${encodeURIComponent(password)}@127.0.0.1:55433/lhl76_final_rehearsal_clean`});
const normal=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(normal):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normal(v[k])])):v;
const equal=(a,b)=>JSON.stringify(normal(a))===JSON.stringify(normal(b));
const plan={createdAt:new Date().toISOString(),models:{},summary:{},workingWrites:0};
try{await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');for(const [model,rows] of Object.entries(original)){
 const current=await tx[model].findMany(),before=new Map(rows.map(r=>[r.id,r])),after=new Map(current.map(r=>[r.id,r]));
 const create=current.filter(r=>!before.has(r.id)),update=[],removed=rows.filter(r=>!after.has(r.id));
 if(removed.length)throw new Error(`Deleted original rows: ${model}`);
 const fields={};for(const row of current){const old=before.get(row.id);if(!old)continue;const keys=Object.keys(row).filter(k=>k!=='updatedAt'&&!equal(old[k],row[k]));if(keys.length){update.push({id:row.id,before:old,after:row,fields:keys});for(const key of keys)fields[key]=(fields[key]||0)+1;}}
 if(create.length||update.length){plan.models[model]={create,update};plan.summary[model]={create:create.length,update:update.length,fields};}
 }},{timeout:120000});
 const output=path.join(root,`approved-delta-${Date.now()}.json`);fs.writeFileSync(output,JSON.stringify(plan,null,2),{flag:'wx'});console.log(JSON.stringify({output,summary:plan.summary},null,2));
}finally{await db.$disconnect();}
