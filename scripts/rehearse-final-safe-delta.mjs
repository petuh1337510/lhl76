import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {PrismaClient,Prisma} from '@prisma/client';
const dir=path.resolve(process.argv[2]||''),backup=path.resolve(process.argv[3]||'');
if(!dir.startsWith(path.resolve('work')+path.sep)||!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Expected private audit and backup paths');
const read=(root,name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const verification=read(backup,'complete-verification.json');if(!verification.databaseVerified||!verification.filesVerified)throw new Error('Both restore checks required');
const {container,user,database,port}=verification.target;
if(!container.startsWith('lhl76-final-reconcile-')||!['lhl76_final_rehearsal','lhl76_final_rehearsal_clean'].includes(database)||port!==55433)throw new Error('Not the isolated rehearsal target');
const inspect=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
if(inspect.Config.Labels?.['lhl76.purpose']!=='final-reconciliation'||inspect.NetworkSettings.Ports['5432/tcp'][0].HostIp!=='127.0.0.1')throw new Error('Container isolation mismatch');
const password=inspect.Config.Env.find(e=>e.startsWith('POSTGRES_PASSWORD=')).slice('POSTGRES_PASSWORD='.length);
const url=`postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
const working=new URL(process.env.DATABASE_URL);if(Number(working.port)===port||working.pathname.slice(1)===database)throw new Error('Working and test targets not distinct');
const db=new PrismaClient({datasources:{db:{url}}});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const snapshot=read(dir,'current-snapshot.json');
const availableMedia=new Set(read(dir,'media.json').filter(m=>m.available).map(m=>m.url));
const stagedPath=path.join(dir,'staged-media-results.json');if(fs.existsSync(stagedPath))for(const m of read(dir,'staged-media-results.json').results.filter(m=>m.ok))availableMedia.add(m.url);
const raw=read(dir,'three-way-review.json').changes;
const allowed={player:new Set(['baseNumber','birthPlace','league','photoUrl','position']),team:new Set(['name'])};
const updates=raw.filter(c=>c.classification==='SOURCE_CHANGED_CURRENT_MATCHES_PREVIOUS'&&allowed[c.type]?.has(c.field)&&c.source!==null&&c.source!==''&&(c.field!=='photoUrl'||availableMedia.has(c.source)));
const newPlayers=read(dir,'new-player-review.json').filter(p=>p.usedInMappedCompetition&&p.sameNameCandidates.length===0).map(p=>({legacyId:p.legacyId,id:randomUUID(),data:p.desired}));
const numbers=read(dir,'squad-differences.json').filter(s=>s.status==='NUMBER_DIFFERENT'&&s.current===null&&s.source!==null&&s.source!=='').map(s=>({id:s.targetId,number:s.source}));
const plan={scope:'PARTIAL_NON_DESTRUCTIVE_REHEARSAL_ONLY',updates,newPlayers,numbers,excluded:['Existing match scores/status/events pending conflict review','New matches, team entries and rosters pending full protocol reconciliation','Current ratings and historical classifications','Unreferenced or ambiguous new players','Custom protocols, suspensions, local-only records'],workingWrites:0};
fs.writeFileSync(path.join(dir,'partial-trial-plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
async function apply(tx,fail=false){
 let updated=0,created=0,numberUpdates=0;
 for(const c of updates){const row=await tx[c.type].findUniqueOrThrow({where:{id:c.targetId}});if(String(row[c.field]??'')===String(c.source??''))continue;if(String(row[c.field]??'')!==String(c.current??''))throw new Error('Unexpected current field; abort');await tx[c.type].update({where:{id:c.targetId},data:{[c.field]:c.source}});updated++;if(fail)throw new Error('EXPECTED_REHEARSAL_ROLLBACK');}
 for(const p of newPlayers){const existing=await tx.player.findUnique({where:{id:p.id}});if(existing)continue;const data={...p.data,id:p.id,slug:`legacy-player-${p.legacyId}`};if(data.birthDate)data.birthDate=new Date(data.birthDate);if(!data.firstName||!data.lastName)throw new Error('New player has incomplete name');await tx.player.create({data});await tx.legacyImportMap.create({data:{source:'joomsport:lhlnew:final-2026-10-29',entityType:'player',legacyId:String(p.legacyId),entityId:p.id}});created++;}
 for(let offset=0;offset<numbers.length;offset+=500){const chunk=numbers.slice(offset,offset+500),ids=chunk.map(n=>n.id),existing=await tx.matchRoster.findMany({where:{id:{in:ids}}});if(existing.length!==chunk.length)throw new Error('Missing roster row');const desired=new Map(chunk.map(n=>[n.id,n.number]));if(existing.some(r=>r.numberOverride!==null&&r.numberOverride!==desired.get(r.id)))throw new Error('Conflicting match number');numberUpdates+=await tx.$executeRaw(Prisma.sql`UPDATE "MatchRoster" AS r SET "numberOverride"=v.number FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS v(id text,number text) WHERE r.id=v.id AND r."numberOverride" IS NULL`);}
 return {updatedFields:updated,createdPlayers:created,updatedMatchNumbers:numberUpdates};
}
try{
 const connected=await db.$queryRaw`SELECT current_database() AS name`;if(connected[0].name!==database)throw new Error('Database identity mismatch');
 const first=updates[0];if(!first)throw new Error('Need at least one update for rollback test');const before=hash(await db[first.type].findUnique({where:{id:first.targetId}}));let rolledBack=false;
 try{await db.$transaction(tx=>apply(tx,true),{timeout:120000});}catch(e){if(e.message!=='EXPECTED_REHEARSAL_ROLLBACK')throw e;rolledBack=before===hash(await db[first.type].findUnique({where:{id:first.targetId}}));}
 if(!rolledBack)throw new Error('Rollback test failed');
 const firstRun=await db.$transaction(tx=>apply(tx),{timeout:120000});
 const secondRun=await db.$transaction(tx=>apply(tx),{timeout:120000});
 const preserved={matches:hash(await db.match.findMany({orderBy:{id:'asc'}}))===hash([...snapshot.match].sort((a,b)=>a.id.localeCompare(b.id))),suspensions:hash(await db.playerSuspension.findMany({orderBy:{id:'asc'}}))===hash([...snapshot.playerSuspension].sort((a,b)=>a.id.localeCompare(b.id)))};
 const report={checkedAt:new Date().toISOString(),scope:plan.scope,target:{container,database,port},rolledBack,firstRun,secondRun,idempotent:Object.values(secondRun).every(n=>n===0),preserved,workingWrites:0,fullImportReady:false};fs.writeFileSync(path.join(dir,'partial-trial-results.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify(report,null,2));
}finally{await db.$disconnect();}
