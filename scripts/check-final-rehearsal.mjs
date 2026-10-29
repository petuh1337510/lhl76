import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
const dir=path.resolve(process.argv[2]||''),backup=path.resolve(process.argv[3]||'');if(!dir.startsWith(path.resolve('work')+path.sep)||!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Unexpected paths');
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')),verification=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
const {container,user,database,port}=verification.target;if(database!=='lhl76_final_rehearsal_clean'||port!==55433||!container.startsWith('lhl76-final-reconcile-'))throw new Error('Wrong target');
const config=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0],password=config.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18);
const db=new PrismaClient({datasourceUrl:`postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`});
const baseline=load('current-snapshot.json'),result={checkedAt:new Date().toISOString(),target:database,idPreservation:[],divisions:[],http:[],workingWrites:0};
try{
 await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');for(const model of Object.keys(baseline)){const existing=await tx[model].findMany({select:{id:true}}),ids=new Set(existing.map(r=>r.id));result.idPreservation.push({model,before:baseline[model].length,after:existing.length,missingOriginalIds:baseline[model].filter(r=>!ids.has(r.id)).map(r=>r.id)});}
 const divisions=await tx.division.findMany({include:{competition:{include:{season:true}},_count:{select:{matches:true,teamEntries:true}}}});
 for(const d of divisions)result.divisions.push({id:d.id,season:d.competition.season.name,competition:d.competition.name,division:d.name,matches:d._count.matches,teams:d._count.teamEntries});
 result.selectedMatches=await tx.match.findMany({where:{id:{in:baseline.legacyImportMap.filter(m=>m.entityType==='match'&&['13976','14058'].includes(m.legacyId)).map(m=>m.entityId)}},select:{slug:true,homeScore:true,awayScore:true,resultType:true,_count:{select:{goals:true,assists:true}}}});
 result.totals={matches:await tx.match.count(),players:await tx.player.count(),teamEntries:await tx.teamEntry.count(),rosters:await tx.rosterEntry.count()};
 },{timeout:120000});
 for(const url of ['http://localhost:3000/','http://127.0.0.1:3002/','http://127.0.0.1:3002/competition/2026-27/championship/debyut?tab=calendar',...result.selectedMatches.map(m=>'http://127.0.0.1:3002/match/'+m.slug)]){const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),html=await response.text();result.http.push({url,status:response.status,title:html.match(/<title>([^<]+)<\/title>/)?.[1]||null});}
 result.allOriginalIdsPreserved=result.idPreservation.every(r=>r.missingOriginalIds.length===0);
 fs.writeFileSync(path.join(dir,`verification-${Date.now()}.json`),JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({allOriginalIdsPreserved:result.allOriginalIdsPreserved,totals:result.totals,http:result.http.map(r=>({status:r.status,title:r.title}))},null,2));
}finally{await db.$disconnect();}
