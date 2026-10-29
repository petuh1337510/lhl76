import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const audit=path.resolve('work/final-reconciliation-2026-10-29T12-31-10-973Z');
const backup=path.resolve(process.argv[2]||'');
const working=process.argv.includes('--working');
if(!backup.startsWith(path.resolve('backups')+path.sep))throw Error('Backup required');
const read=name=>JSON.parse(fs.readFileSync(path.join(audit,name),'utf8'));
const verification=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!verification.databaseVerified||!verification.filesVerified||!verification.constraintsMatch||!fs.existsSync(path.join(verification.independentCopy,'database.dump')))throw Error('Verified independent backup required');
const snapshot=read('current-snapshot.json'),allowed=new Set(['firstName','lastName','patronymic','birthDate','position','baseNumber']);
const changes=read('field-differences.json').filter(d=>d.type==='player'&&allowed.has(d.field)&&d.source!==null&&d.source!=='').map(d=>({model:'player',id:d.targetId,field:d.field,before:d.current,after:d.source,name:snapshot.player.find(p=>p.id===d.targetId)?.lastName,legacyId:d.legacyId}));
if(changes.length!==8)throw Error('Unexpected reviewed plan');
for(const c of changes.filter(d=>d.field==='baseNumber'))for(const r of snapshot.rosterEntry.filter(r=>r.playerId===c.id&&r.number===c.before)){
 const entry=snapshot.teamEntry.find(e=>e.id===r.teamEntryId),division=snapshot.division.find(d=>d.id===entry?.divisionId),competition=snapshot.competition.find(d=>d.id===division?.competitionId),season=snapshot.season.find(s=>s.id===competition?.seasonId);
 if(season?.isActive)changes.push({model:'rosterEntry',id:r.id,field:'number',before:r.number,after:c.after,name:c.name,legacyId:c.legacyId});
}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const planHash=digest(changes);
const reportPath=path.join(backup,working?'profile-working.json':'profile-rehearsal.json');
if(fs.existsSync(reportPath))throw Error('Report already exists; do not overwrite');
let url;
if(working){
 const trial=JSON.parse(fs.readFileSync(path.join(backup,'profile-rehearsal.json'),'utf8'));
 if(trial.planHash!==planHash||!trial.verified||trial.secondWrites!==0)throw Error('Successful matching rehearsal required');
 url=process.env.DATABASE_URL;const parsed=new URL(url);
 if(decodeURIComponent(parsed.pathname.slice(1))!==verification.source.database||!['localhost','127.0.0.1'].includes(parsed.hostname)||(parsed.port||'5432')!=='5432')throw Error('Unexpected working target');
}else{
 const t=verification.target;
 if(t.port!==55433||!t.database.startsWith('approved_restore_')||t.database===verification.source.database)throw Error('Unsafe rehearsal target');
 const config=JSON.parse(execFileSync('docker',['inspect',t.container],{encoding:'utf8'}))[0];
 if(config.Config.Labels?.['lhl76.purpose']!=='final-reconciliation')throw Error('Wrong container');
 const password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
 url=`postgresql://${t.user}:${encodeURIComponent(password)}@127.0.0.1:${t.port}/${t.database}`;
}
const db=new PrismaClient({datasourceUrl:url});
const normalize=v=>v instanceof Date?v.toISOString():v;
const run=()=>db.$transaction(async tx=>{
 const models=Object.keys(db).filter(k=>!k.startsWith('_')&&!k.startsWith('$')&&typeof db[k]?.findMany==='function');
 const before={};for(const model of models)before[model]=await tx[model].findMany();
 let writes=0;
 for(const c of changes){
  const row=await tx[c.model].findUniqueOrThrow({where:{id:c.id}});
  if(normalize(row[c.field])===c.after)continue;
  if(normalize(row[c.field])!==c.before)throw Error('Concurrent field change: '+c.name+' '+c.field);
  const saved=snapshot[c.model].find(r=>r.id===c.id);
  if(row.updatedAt&&normalize(row.updatedAt)!==saved.updatedAt)throw Error('Record edited after audit: '+c.name);
  await tx[c.model].update({where:{id:c.id},data:{[c.field]:c.field==='birthDate'?new Date(c.after):c.after}});writes++;
 }
 for(const model of models){
  const after=await tx[model].findMany();
  const expected=before[model].map(row=>{const result={...row};for(const c of changes.filter(c=>c.model===model&&c.id===row.id))result[c.field]=c.field==='birthDate'?new Date(c.after):c.after;return result});
  const canonical=rows=>rows.map(row=>{const r={...row};if(changes.some(c=>c.model===model&&c.id===row.id))delete r.updatedAt;return JSON.stringify(r)}).sort();
  if(digest(canonical(expected))!==digest(canonical(after)))throw Error('Unexpected data changes in '+model);
 }
 return writes;
},{timeout:120000,isolationLevel:'Serializable'});
try{
 const firstWrites=await run(),secondWrites=await run();
 const report={checkedAt:new Date().toISOString(),working,planHash,firstWrites,secondWrites,verified:secondWrites===0,changes,backup};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
 fs.copyFileSync(reportPath,path.join(verification.independentCopy,path.basename(reportPath)),fs.constants.COPYFILE_EXCL);
 console.log(JSON.stringify({working,firstWrites,secondWrites,verified:report.verified,reportPath,changes},null,2));
}finally{await db.$disconnect()}
