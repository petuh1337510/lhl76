import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {PrismaClient,Prisma} from '@prisma/client';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
import {calculateDivisionStatistics} from '../src/lib/domain/division-statistics.ts';
import {deriveMatchProtocol} from '../src/lib/domain/match-protocol.ts';
const dir=path.resolve(process.argv[2]||''),backup=path.resolve(process.argv[3]||'');
if(!dir.startsWith(path.resolve('work')+path.sep)||!backup.startsWith(path.resolve('backups')+path.sep))throw new Error('Invalid private paths');
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const verified=JSON.parse(fs.readFileSync(path.join(backup,'complete-verification.json'),'utf8'));
if(!verified.databaseVerified||!verified.filesVerified)throw new Error('Verified backup required');
const {container,user,database,port}=verified.target;
if(!container.startsWith('lhl76-final-reconcile-')||!['lhl76_final_rehearsal','lhl76_final_rehearsal_clean'].includes(database)||port!==55433)throw new Error('Test target required');
const inspection=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
if(inspection.Config.Labels?.['lhl76.purpose']!=='final-reconciliation')throw new Error('Wrong container');
const password=inspection.Config.Env.find(s=>s.startsWith('POSTGRES_PASSWORD=')).slice(18),url=`postgresql://${user}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
const working=new URL(process.env.DATABASE_URL);if(Number(working.port)===port||working.pathname.slice(1)===database)throw new Error('Not isolated');
const db=new PrismaClient({datasourceUrl:url});
const dump=await readFinalDump(path.join(dir,'source.sql')),rows=n=>dump.tables.get(n)||[],posts=new Map(rows('wp_posts').map(p=>[Number(p.ID),p])),terms=new Map(rows('wp_terms').map(t=>[Number(t.term_id),t.name]));
const oldMatches=rows('wp_joomsport_matches'),events=rows('wp_joomsport_match_events'),oldSquads=rows('wp_joomsport_squad'),oldRoster=rows('wp_joomsport_playerlist');
const fields=['teamEntry','rosterEntry','match','matchStage','matchRoster','goal','assist','penalty','legacyMatchEvent','legacyImportMap','division','competition','season','venue'];
const current={};for(const model of fields)current[model]=await db[model].findMany();
const ids=new Map();for(const m of current.legacyImportMap)if(m.source.startsWith('joomsport:lhlnew:'))ids.set(`${m.entityType}:${m.legacyId}`,m.entityId);
const find=(t,id)=>ids.get(`${t}:${id}`),sourceFor=div=>current.legacyImportMap.find(m=>m.entityType==='division'&&m.entityId===div)?.source;
const changes=load('field-differences.json'),eventDiff=load('event-differences.json');
const affected=new Set([...load('new-record-candidates.json').filter(r=>r.type==='match').map(r=>Number(r.legacyId)),...changes.filter(c=>c.type==='match').map(c=>Number(c.legacyId)),...eventDiff.map(c=>Number(c.matchLegacyId))]);
const technicalIds=new Set(current.match.filter(m=>m.resultType==='TECHNICAL').map(m=>m.id));
const plan={teamEntry:[],rosterEntry:[],match:[],matchRoster:[],goal:[],assist:[],penalty:[],legacyMatchEvent:[],legacyImportMap:[],delete:{assist:[],goal:[],penalty:[]},warnings:[],preservedTechnical:[],affectedDivisions:[]};
const entryIndex=new Map(current.teamEntry.map(e=>[`${e.divisionId}:${e.teamId}`,e]));
function teamEntry(legacyDivision,legacyTeam){const divisionId=find('division',legacyDivision),teamId=find('team',legacyTeam);if(!divisionId||!teamId)throw new Error(`Missing team identity ${legacyDivision}:${legacyTeam}`);const key=`${divisionId}:${teamId}`;if(!entryIndex.has(key)){const row={id:randomUUID(),divisionId,teamId};entryIndex.set(key,row);plan.teamEntry.push(row);}return entryIndex.get(key);}
const rosterIndex=new Map(current.rosterEntry.map(r=>[`${r.teamEntryId}:${r.playerId}`,r]));
function roster(legacyDivision,legacyTeam,legacyPlayer){const entry=teamEntry(legacyDivision,legacyTeam),playerId=find('player',legacyPlayer);if(!playerId)throw new Error(`Missing player mapping ${legacyPlayer}`);const key=`${entry.id}:${playerId}`;if(!rosterIndex.has(key)){const isActive=oldRoster.some(r=>Number(r.season_id)===Number(legacyDivision)&&Number(r.team_id)===Number(legacyTeam)&&Number(r.player_id)===Number(legacyPlayer));const row={id:randomUUID(),teamEntryId:entry.id,playerId,status:isActive?'ACTIVE':'INACTIVE',number:null};rosterIndex.set(key,row);plan.rosterEntry.push(row);}return rosterIndex.get(key);}
const clocks=v=>{const text=String(v??'');if(/^\d{1,3}:\d{2}$/.test(text)){const [m,s]=text.split(':').map(Number);return s<60?m*60+s:null;}return /^\d+$/.test(text)?Number(text)*60:null;};
const used={goal:new Set(),assist:new Set(),penalty:new Set()};
function reuse(model,matchId,playerField,playerId,teamEntryId,clock){
 const candidates=current[model].filter(r=>r.matchId===matchId&&r[playerField]===playerId&&r.teamEntryId===teamEntryId&&!used[model].has(r.id));
 const exact=candidates.filter(r=>clock===undefined||r.clockSeconds===clock);const chosen=exact[0]||(candidates.length===1?candidates[0]:null);
 if(chosen)used[model].add(chosen.id);return chosen;
}
for(const m of oldMatches.filter(m=>affected.has(Number(m.postID)))){
 const legacyId=Number(m.postID),existing=current.match.find(r=>r.id===find('match',legacyId));
 if(existing&&technicalIds.has(existing.id)){plan.preservedTechnical.push({legacyId,id:existing.id});continue;}
 const divisionId=find('division',m.seasonID);if(!divisionId){plan.warnings.push({kind:'excluded-unmapped-division',legacyId});continue;}
 const home=teamEntry(m.seasonID,m.teamHomeID),away=teamEntry(m.seasonID,m.teamAwayID);
 const stageName=terms.get(Number(m.mdID));const stage=current.matchStage.find(s=>s.divisionId===divisionId&&s.name===stageName);
 if(!stage)throw new Error(`Stage needs explicit mapping: ${m.seasonID}:${m.mdID}`);
 let startsAt=null;if(m.date&&m.date!=='0000-00-00'){const time=String(m.time||'00:00').padStart(5,'0');startsAt=new Date(`${m.date}T${time.length===5?time+':00':time}+03:00`);if(Number.isNaN(+startsAt))throw new Error('Invalid match date');}
 const matchId=existing?.id||randomUUID();ids.set(`match:${legacyId}`,matchId);
 const matchData={id:matchId,divisionId,stageId:stage.id,homeTeamEntryId:home.id,awayTeamEntryId:away.id,startsAt,status:Number(m.status)===1?'FINAL':'SCHEDULED',homeScore:Number(m.scoreHome),awayScore:Number(m.scoreAway)};
 if(!existing){matchData.slug=String(posts.get(legacyId)?.post_name||`legacy-match-${legacyId}`);matchData.resultType='NORMAL';if(current.match.some(c=>c.slug===matchData.slug))throw new Error('Match slug collision');plan.legacyImportMap.push({id:randomUUID(),source:sourceFor(divisionId),entityType:'match',legacyId:String(legacyId),entityId:matchId});}
 plan.match.push(matchData);plan.affectedDivisions.push(divisionId);
 for(const s of oldSquads.filter(s=>Number(s.match_id)===legacyId&&String(s.squad_type)==='1')){const r=roster(s.season_id,s.team_id,s.player_id);if(![home.id,away.id].includes(r.teamEntryId))throw new Error('Squad team mismatch');const old=current.matchRoster.find(x=>x.matchId===matchId&&x.rosterEntryId===r.id);plan.matchRoster.push({id:old?.id||randomUUID(),matchId,rosterEntryId:r.id,numberOverride:String(s.match_num||'').trim()||old?.numberOverride||null});}
 const recentGoal=new Map();const eventTypes=new Map(rows('wp_joomsport_events').map(e=>[Number(e.id),e.e_name]));
 for(const e of events.filter(e=>Number(e.match_id)===legacyId).sort((a,b)=>Number(a.eordering)-Number(b.eordering)||Number(a.id)-Number(b.id))){
   const entry=teamEntry(e.season_id,e.t_id);if(![home.id,away.id].includes(entry.id))throw new Error(`Event team mismatch ${e.id}`);
   const playerId=find('player',e.player_id)||null;const clockSeconds=clocks(e.minutes_input||e.minutes),period=clockSeconds===null?null:Math.max(1,Math.floor(clockSeconds/1200)+1),key=`${e.t_id}:${e.minutes_input||e.minutes}`;
   if(playerId)roster(e.season_id,e.t_id,e.player_id);
   if(Number(e.e_id)===1){if(!playerId)throw new Error('Goal scorer not resolved');const old=reuse('goal',matchId,'scorerId',playerId,entry.id,clockSeconds);const g={id:old?.id||randomUUID(),matchId,teamEntryId:entry.id,scorerId:playerId,clockSeconds,period};plan.goal.push(g);recentGoal.set(key,g);}
   else if(Number(e.e_id)===2){if(!playerId)throw new Error('Assistant not resolved');const g=recentGoal.get(key),old=reuse('assist',matchId,'playerId',playerId,entry.id);const order=g?plan.assist.filter(a=>a.goalId===g.id).length+1:1;plan.assist.push({id:old?.id||randomUUID(),matchId,teamEntryId:entry.id,playerId,goalId:g?.id||null,order});if(!g)plan.warnings.push({kind:'unlinked-assist-preserved',legacyId:e.id,matchLegacyId:legacyId});}
   else if(Number(e.e_id)===3){const old=reuse('penalty',matchId,'playerId',playerId,entry.id,clockSeconds);plan.penalty.push({id:old?.id||randomUUID(),matchId,teamEntryId:entry.id,playerId,clockSeconds,period,minutes:Math.max(1,Number(e.ecount||1)),reason:e.Eventreason===null||e.Eventreason===''?null:String(e.Eventreason)});}
   else plan.warnings.push({kind:'legacy-event-only',legacyId:e.id,eventCode:e.e_id,matchLegacyId:legacyId});
   const old=current.legacyMatchEvent.find(r=>r.matchId===matchId&&r.legacyId===String(e.id));plan.legacyMatchEvent.push({id:old?.id||randomUUID(),source:sourceFor(divisionId),legacyId:String(e.id),matchId,teamEntryId:entry.id,playerId,eventCode:String(e.e_id),eventType:eventTypes.get(Number(e.e_id))||String(e.e_id),count:Number(e.ecount||1),minute:String(e.minutes_input||e.minutes||'')||null,reason:e.Eventreason===null||e.Eventreason===''?null:String(e.Eventreason),raw:{ordering:Number(e.eordering||0),minuteEnd:e.minutes_end||null,additionalTo:Number(e.additional_to||0),stageId:Number(e.stage_id||0)}});
 }
 for(const model of ['assist','goal','penalty'])for(const r of current[model].filter(r=>r.matchId===matchId&&!used[model].has(r.id)))plan.delete[model].push(r.id);
 const score=[plan.goal.filter(g=>g.matchId===matchId&&g.teamEntryId===home.id).length,plan.goal.filter(g=>g.matchId===matchId&&g.teamEntryId===away.id).length];
 if(matchData.status==='FINAL'&&(score[0]!==matchData.homeScore||score[1]!==matchData.awayScore))plan.warnings.push({kind:'score-vs-goals',legacyId,score:[matchData.homeScore,matchData.awayScore],goals:score});
}
// Official roster additions, without manufacturing historical numbers from a global profile.
for(const r of oldRoster){if(!find('division',r.season_id))continue;const official=rows('wp_joomsport_season_table').some(s=>Number(s.season_id)===Number(r.season_id)&&Number(s.participant_id)===Number(r.team_id));if(!official)continue;roster(r.season_id,r.team_id,r.player_id);}
plan.affectedDivisions=[...new Set(plan.affectedDivisions)];
// A locally recorded event absent from the dump is a conflict, not permission
// to remove it. Hold the entire event merge for that match; keep source score.
const heldEventMatches=new Set();
for(const model of ['goal','assist','penalty'])for(const id of plan.delete[model])heldEventMatches.add(current[model].find(r=>r.id===id).matchId);
for(const matchId of heldEventMatches){for(const model of ['goal','assist','penalty','legacyMatchEvent'])plan[model]=plan[model].filter(r=>r.matchId!==matchId);plan.warnings.push({kind:'local-only-events-held',matchId});}
const trialStamp=Date.now();
fs.writeFileSync(path.join(dir,`match-trial-plan-${trialStamp}.json`),JSON.stringify(plan,null,2),{flag:'wx'});
const canonical=v=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const eq=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
async function apply(tx){const counters={created:{},updated:{},removed:{}};
 // Missing legacy events do NOT authorize deleting locally recorded goals.
 // Keep the candidate list for review; do not apply deletions.
 // Clear old goal links only inside this transaction to avoid transient unique order collisions.
 for(const a of plan.assist){const old=await tx.assist.findUnique({where:{id:a.id}});if(old&&old.goalId&&(old.goalId!==a.goalId||old.order!==a.order))await tx.assist.update({where:{id:a.id},data:{goalId:null}});}
 for(const model of ['teamEntry','rosterEntry','match','matchRoster','goal','assist','penalty','legacyMatchEvent','legacyImportMap']){
   for(const row of plan[model]){const old=await tx[model].findUnique({where:{id:row.id}});if(!old){await tx[model].create({data:row});counters.created[model]=(counters.created[model]||0)+1;}else{const update=Object.fromEntries(Object.entries(row).filter(([k,v])=>k!=='id'&&!eq(old[k],v)));if(Object.keys(update).length){await tx[model].update({where:{id:row.id},data:update});counters.updated[model]=(counters.updated[model]||0)+1;}}}
 }
 for(const planned of plan.match){
   const m=await tx.match.findUniqueOrThrow({where:{id:planned.id},include:{rosters:{include:{rosterEntry:true}},goals:{include:{assists:true}},assists:true,penalties:true}});
   const protocol=m.protocolData&&typeof m.protocolData==='object'?m.protocolData:{};
   const derived=deriveMatchProtocol({homeTeamEntryId:m.homeTeamEntryId,awayTeamEntryId:m.awayTeamEntryId,status:m.status,roster:m.rosters.map(r=>({playerId:r.rosterEntry.playerId,teamEntryId:r.rosterEntry.teamEntryId})),goals:m.goals.map(g=>({...g,assist1Id:g.assists[0]?.playerId,assist2Id:g.assists[1]?.playerId})),penalties:m.penalties,goalieStints:Array.isArray(protocol.goalieStints)?protocol.goalieStints:[]});
   const contributions=new Map(derived.contributions.map(c=>[`${c.playerId}:${c.teamEntryId}`,{...c,goals:0,assists:0,penaltyMinutes:0,games:0}]));
   const add=(playerId,teamEntryId,field,n)=>{const key=`${playerId}:${teamEntryId}`;if(!contributions.has(key))contributions.set(key,{playerId,teamEntryId,games:0,goals:0,assists:0,penaltyMinutes:0,goalieGames:0,goalieSeconds:0,shotsAgainst:0,goalieGoalsAgainst:0});contributions.get(key)[field]+=n;};
   for(const r of m.rosters)add(r.rosterEntry.playerId,r.rosterEntry.teamEntryId,'games',1);for(const g of m.goals)add(g.scorerId,g.teamEntryId,'goals',1);for(const a of m.assists)add(a.playerId,a.teamEntryId,'assists',1);for(const p of m.penalties)if(p.playerId)add(p.playerId,p.teamEntryId,'penaltyMinutes',p.minutes);
   const nextProtocol={...protocol,statContributions:m.status==='FINAL'?[...contributions.values()].sort((a,b)=>(a.playerId+a.teamEntryId).localeCompare(b.playerId+b.teamEntryId)):[]};
   const complete=derived.homeScore===m.homeScore&&derived.awayScore===m.awayScore;
   const nextPeriods=m.status==='FINAL'&&complete?derived.periodScores:null;
   const update={};if(!eq(protocol,nextProtocol))update.protocolData=nextProtocol;if(!eq(m.periodScores,nextPeriods))update.periodScores=nextPeriods===null?Prisma.DbNull:nextPeriods;
   if(Object.keys(update).length){await tx.match.update({where:{id:m.id},data:update});counters.updated.protocolMetadata=(counters.updated.protocolMetadata||0)+1;}
 }
 for(const divisionId of plan.affectedDivisions){
   // Use the site's existing standings rules, never the stored WordPress totals.
   const teamEntries=await tx.teamEntry.findMany({where:{divisionId}});
   const forStandings=await tx.match.findMany({where:{divisionId,status:'FINAL',stage:{countsForStandings:true}},include:{penalties:true}});
   const calculated=calculateDivisionStatistics(teamEntries.map(e=>e.id),forStandings.map(m=>({home:m.homeTeamEntryId,away:m.awayTeamEntryId,homeGoals:m.homeScore,awayGoals:m.awayScore,homePenaltyMinutes:m.resultType==='TECHNICAL'?0:m.penalties.filter(p=>p.teamEntryId===m.homeTeamEntryId).reduce((s,p)=>s+p.minutes,0),awayPenaltyMinutes:m.resultType==='TECHNICAL'?0:m.penalties.filter(p=>p.teamEntryId===m.awayTeamEntryId).reduce((s,p)=>s+p.minutes,0),technicalWinner:m.resultType==='TECHNICAL'&&typeof m.protocolData?.technicalWinnerTeamEntryId==='string'?m.protocolData.technicalWinnerTeamEntryId:null,excludeGoals:m.resultType==='TECHNICAL'})));
   const existingStandings=await tx.standing.findMany({where:{divisionId}}),standingByTeam=new Map(existingStandings.map(s=>[s.teamEntryId,s]));
   const changedRanks=calculated.some(r=>standingByTeam.get(r.teamEntryId)?.rank!==r.rank);
   if(changedRanks)for(let i=0;i<existingStandings.length;i++)await tx.standing.update({where:{id:existingStandings[i].id},data:{rank:-100000-i}});
   for(const r of calculated){const {rank,...data}=r;const oldStat=await tx.teamStatistic.findUnique({where:{teamEntryId:r.teamEntryId}});if(!oldStat)await tx.teamStatistic.create({data});else{const changed=Object.fromEntries(Object.entries(data).filter(([k,v])=>!eq(oldStat[k],v)));if(Object.keys(changed).length)await tx.teamStatistic.update({where:{id:oldStat.id},data:changed});}const old=standingByTeam.get(r.teamEntryId);if(!old)await tx.standing.create({data:{divisionId,teamEntryId:r.teamEntryId,rank,points:r.points}});else if(changedRanks||old.points!==r.points)await tx.standing.update({where:{id:old.id},data:{rank,points:r.points}});}
   const matches=await tx.match.findMany({where:{divisionId,status:'FINAL',resultType:{not:'TECHNICAL'}},include:{rosters:{include:{rosterEntry:true}},goals:true,assists:true,penalties:true}});
   const totals=new Map();const get=(playerId,teamEntryId)=>{const key=`${playerId}:${teamEntryId}`;if(!totals.has(key))totals.set(key,{playerId,teamEntryId,games:0,goals:0,assists:0,penaltyMinutes:0});return totals.get(key);};
   for(const m of matches){for(const r of m.rosters)get(r.rosterEntry.playerId,r.rosterEntry.teamEntryId).games++;for(const g of m.goals)get(g.scorerId,g.teamEntryId).goals++;for(const a of m.assists)get(a.playerId,a.teamEntryId).assists++;for(const p of m.penalties)if(p.playerId)get(p.playerId,p.teamEntryId).penaltyMinutes+=p.minutes;}
   const existing=await tx.playerStatistic.findMany({where:{teamEntry:{divisionId}}});for(const s of existing){const n=totals.get(`${s.playerId}:${s.teamEntryId}`)||{games:0,goals:0,assists:0,penaltyMinutes:0};const data=Object.fromEntries(['games','goals','assists','penaltyMinutes'].filter(k=>s[k]!==n[k]).map(k=>[k,n[k]]));if(Object.keys(data).length)await tx.playerStatistic.update({where:{id:s.id},data});totals.delete(`${s.playerId}:${s.teamEntryId}`);}for(const s of totals.values())await tx.playerStatistic.create({data:s});
 }
 return counters;
}
try{
 const first=await db.$transaction(tx=>apply(tx),{timeout:240000});const second=await db.$transaction(tx=>apply(tx),{timeout:240000});
 const protectedChecks=[];for(const p of plan.preservedTechnical){const before=current.match.find(m=>m.id===p.id),after=await db.match.findUnique({where:{id:p.id}});protectedChecks.push({legacyId:p.legacyId,unchanged:JSON.stringify(before)===JSON.stringify(after)});}
 const sourceSquads=plan.matchRoster.length,loadedSquads=await db.matchRoster.count({where:{id:{in:plan.matchRoster.map(r=>r.id)}}});
 const report={scope:'MATCH_REHEARSAL_ONLY_REQUIRES_REVIEW',target:{container,database,port},first,second,coreRowsIdempotent:Object.values(second).every(group=>Object.values(group).every(n=>n===0)),protectedChecks,sourceSquads,loadedSquads,warnings:plan.warnings,affectedDivisions:plan.affectedDivisions.length,workingWrites:0,limitations:['Goalkeeper box statistics require semantic verification','Local-only events are retained pending review; score and event discrepancies are not fabricated away']};
 fs.writeFileSync(path.join(dir,`match-trial-results-${trialStamp}.json`),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({...report,warnings:plan.warnings.length},null,2));
}finally{await db.$disconnect();}
