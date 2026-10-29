import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
import {serializedString} from './lib/legacy-2023-24-data.mjs';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const backup=path.resolve('backups/approved-2026-10-29T09-38-50-186Z');
const verification=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!verification.databaseVerified||!verification.filesVerified)throw new Error('Verified fresh backup required');
const working=process.argv.includes('--approved-working');
const target=working?verification.source:verification.target;
if(working){if(target.database!=='lhl76_import_test'||target.container!=='senior-full-stack-76-wordpress-wordpress-postgres-1')throw new Error('Unexpected working target');}
else if(!target.database.startsWith('approved_restore_')||target.port!==55433)throw new Error('Unexpected test target');
const config=JSON.parse(execFileSync('docker',['inspect',target.container],{encoding:'utf8'}))[0];
if(!working&&config.Config.Labels?.['lhl76.purpose']!=='final-reconciliation')throw new Error('Wrong test container');
const password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const db=new PrismaClient({datasourceUrl:`postgresql://${target.user}:${encodeURIComponent(password)}@127.0.0.1:${working?5432:55433}/${target.database}`});
const selectedIds=[2217,2569,2583,2763,2792,2806,2808,2816,2819,2831,2847,2873,2968,2978,2986,2988,3011,4862,7996,7997,8006];
const sourceBytes=fs.readFileSync(path.join(root,'source.sql'));
if(createHash('sha256').update(sourceBytes).digest('hex')!=='cf15c9027ca05c020c88c33083a56f33ea0d9472fd6aa7c7322d2b5627d3a382')throw new Error('Source changed');
const dump=await readFinalDump(path.join(root,'source.sql')),posts=new Map(dump.tables.get('wp_posts').map(p=>[Number(p.ID),p])),meta=dump.tables.get('wp_postmeta');
const review=JSON.parse(fs.readFileSync(path.join(root,'new-player-review.json'),'utf8'));
const media={...JSON.parse(fs.readFileSync('src/lib/legacy-final-media-manifest.json','utf8')),...JSON.parse(fs.readFileSync('src/lib/legacy-media-manifest.json','utf8'))};
const planFile=path.join(root,'approved-21-players-plan.json');
const normalize=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;
const eq=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
try{
 const categories=await db.classificationCategory.findMany();
 let plan;
 if(fs.existsSync(planFile))plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
 else{if(working)throw new Error('Rehearsal first');plan=[];for(const legacyId of selectedIds){const r=review.find(p=>p.legacyId===legacyId);if(!r||r.usedInMappedCompetition||posts.get(legacyId)?.post_status!=='publish'||!r.desired.firstName||!r.desired.lastName)throw new Error('Wrong selected profile');
 const data={...r.desired,id:randomUUID(),slug:`legacy-player-${legacyId}`};
 const extra=meta.find(m=>Number(m.post_id)===legacyId&&m.meta_key==='_joomsport_player_ef')?.meta_value,rating=serializedString(extra,10);
 if(rating){const category=categories.find(c=>c.name===rating);if(category)data.ratingCategoryId=category.id;}
 if(data.photoUrl){const file=media[data.photoUrl];if(!file||!/^\/legacy-media\/[a-f0-9]{64}\.[a-z]+$/.test(file)||!fs.existsSync(path.join('public',file)))throw new Error('Missing local photo');}
 plan.push({legacyId:String(legacyId),sourceRating:rating||null,unmappedRating:rating&&!data.ratingCategoryId?rating:null,data});}
 fs.writeFileSync(planFile,JSON.stringify(plan,null,2),{flag:'wx'});}
 if(plan.length!==21||plan.some(r=>!selectedIds.includes(Number(r.legacyId))))throw new Error('Wrong plan scope');
 const planHash=createHash('sha256').update(fs.readFileSync(planFile)).digest('hex');
 if(working){const proof=JSON.parse(fs.readFileSync(path.join(root,'approved-21-players-rehearsal.json'),'utf8'));if(proof.planHash!==planHash||!proof.rollbackVerified||proof.second!==0||proof.first!==21)throw new Error('Exact plan not verified');}
 async function apply(tx,fail=false){
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
  await tx.$executeRawUnsafe('LOCK TABLE "Player", "LegacyImportMap" IN SHARE ROW EXCLUSIVE MODE');
  let count=0;
  for(const r of plan){const maps=await tx.legacyImportMap.findMany({where:{entityType:'player',legacyId:r.legacyId,source:{startsWith:'joomsport:lhlnew:'}}});
   if(maps.length){if(maps.some(m=>m.entityId!==r.data.id))throw new Error('Existing legacy identity needs review');const current=await tx.player.findUniqueOrThrow({where:{id:r.data.id}});if(Object.keys(r.data).some(k=>!eq(current[k],r.data[k])))throw new Error('Existing profile differs');continue;}
   if(await tx.player.findUnique({where:{slug:r.data.slug}}))throw new Error('Slug conflict');
   await tx.player.create({data:{...r.data,birthDate:r.data.birthDate?new Date(r.data.birthDate):null}});
   await tx.legacyImportMap.create({data:{source:'joomsport:lhlnew:final-2026-10-29',entityType:'player',legacyId:r.legacyId,entityId:r.data.id}});count++;
   if(fail)throw new Error('EXPECTED_ROLLBACK');
  }return count;
 }
 const priorPlayers=await db.player.findMany({orderBy:{id:'asc'}}),priorMaps=await db.legacyImportMap.findMany({orderBy:{id:'asc'}});let rollbackVerified=false;
 if(!working){try{await db.$transaction(tx=>apply(tx,true));}catch(e){if(e.message!=='EXPECTED_ROLLBACK')throw e;}
 rollbackVerified=eq(priorPlayers,await db.player.findMany({orderBy:{id:'asc'}}))&&eq(priorMaps,await db.legacyImportMap.findMany({orderBy:{id:'asc'}}));if(!rollbackVerified)throw new Error('Rollback failed');}
 const first=await db.$transaction(tx=>apply(tx),{timeout:60000}),second=await db.$transaction(tx=>apply(tx),{timeout:60000});
 const after=new Map((await db.player.findMany()).map(p=>[p.id,p]));if(priorPlayers.some(p=>!eq(p,after.get(p.id))))throw new Error('Existing profile changed');
 const newRosters=await db.rosterEntry.count({where:{playerId:{in:plan.map(p=>p.data.id)}}});if(newRosters)throw new Error('Unexpected competition entries');
 const report={checkedAt:new Date().toISOString(),backup,planHash,first,second,rollbackVerified:working?true:rollbackVerified,existingPlayersUnchanged:true,newRosters,workingWrites:working,skippedDemo:8,skippedDrafts:7,localPhotos:plan.filter(r=>r.data.photoUrl).length,unmappedRatings:plan.filter(r=>r.unmappedRating).map(r=>({legacyId:r.legacyId,playerId:r.data.id,name:r.data.lastName+' '+r.data.firstName,sourceRating:r.unmappedRating}))};
 const name=working?'approved-21-players-working.json':'approved-21-players-rehearsal.json';fs.writeFileSync(path.join(root,name),JSON.stringify(report,null,2),{flag:'wx'});fs.copyFileSync(path.join(root,name),path.join(verification.independentCopy,name),fs.constants.COPYFILE_EXCL);
 console.log(JSON.stringify(report));
}finally{await db.$disconnect();}
