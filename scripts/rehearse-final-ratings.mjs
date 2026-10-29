import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
import {serializedString} from './lib/legacy-2023-24-data.mjs';
const dir=path.resolve(process.argv[2]||''),backup=path.resolve(process.argv[3]||'');if(!dir.startsWith(path.resolve('work')+path.sep)||!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Invalid paths');
const v=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));const {container,user,database,port}=v.target;
if(database!=='lhl76_final_rehearsal_clean'||port!==55433||!container.startsWith('lhl76-final-reconcile-')||!v.filesVerified||!v.databaseVerified)throw new Error('Verified clone required');
const config=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0],password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const db=new PrismaClient({datasourceUrl:`postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`});
const dump=await readFinalDump(path.join(dir,'source.sql')),meta=dump.tables.get('wp_postmeta')||[];
try{const mappings=await db.legacyImportMap.findMany({where:{entityType:'player',source:{startsWith:'joomsport:lhlnew:'}}}),categories=await db.classificationCategory.findMany(),players=await db.player.findMany(),changes=[],held=[];
 const current=new Map(players.map(p=>[p.id,p]));const handled=new Set();
 for(const m of mappings){if(handled.has(m.entityId))continue;handled.add(m.entityId);const extra=meta.find(r=>String(r.post_id)===m.legacyId&&r.meta_key==='_joomsport_player_ef')?.meta_value,rating=serializedString(extra,10);if(!rating)continue;const category=categories.find(c=>c.name===rating);if(!category){held.push({legacyId:m.legacyId,rating,reason:'Unknown category; no guessed level'});continue;}const p=current.get(m.entityId);if(p&&p.ratingCategoryId!==category.id)changes.push({id:p.id,legacyId:m.legacyId,before:p.ratingCategoryId,after:category.id,rating});}
 const historyBefore=await db.playerClassification.findMany({orderBy:{id:'asc'}});
 const apply=tx=>Promise.all(changes.map(async c=>{const p=await tx.player.findUniqueOrThrow({where:{id:c.id}});if(p.ratingCategoryId===c.after)return 0;if(p.ratingCategoryId!==c.before)throw new Error('Unexpected rating change');await tx.player.update({where:{id:c.id},data:{ratingCategoryId:c.after}});return 1;}));
 const first=(await db.$transaction(tx=>apply(tx),{timeout:120000})).reduce((a,b)=>a+b,0),second=(await db.$transaction(tx=>apply(tx),{timeout:120000})).reduce((a,b)=>a+b,0);
 const historicalUnchanged=JSON.stringify(historyBefore)===JSON.stringify(await db.playerClassification.findMany({orderBy:{id:'asc'}}));
 const report={checkedAt:new Date().toISOString(),userDecision:'Use nonempty source current rating; keep historical ratings',first,second,historicalUnchanged,changes,held,workingWrites:0};fs.writeFileSync(path.join(dir,'rating-trial-results.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({first,second,historicalUnchanged,held:held.length}));
}finally{await db.$disconnect();}
