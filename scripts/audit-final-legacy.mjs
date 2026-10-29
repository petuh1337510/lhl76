import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
import {serializedString,galleryIds} from './lib/legacy-2023-24-data.mjs';

const source=process.argv[2];if(!source||process.argv.slice(3).length)throw new Error('Usage: node --env-file=.env.local scripts/audit-final-legacy.mjs <dump.sql>; read only, no commit option');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve('work',`final-reconciliation-${stamp}`);fs.mkdirSync(out,{recursive:false});
const save=(name,data)=>fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2),{flag:'wx'});
const hash=createHash('sha256');for await(const chunk of fs.createReadStream(source))hash.update(chunk);
const sha256=hash.digest('hex');fs.copyFileSync(source,path.join(out,'source.sql'),fs.constants.COPYFILE_EXCL);
console.log('Reading dump as data; no SQL execution');
const dump=await readFinalDump(source),rows=name=>dump.tables.get(name)||[];
save('source.json',{name:path.basename(source),size:fs.statSync(source).size,sha256,counts:dump.counts,hazards:dump.hazards,insertBlocks:dump.insertBlocks,lines:dump.lineNumber,sqlExecuted:false});
if(dump.hazards.length)throw new Error(`Potential SQL hazards: inspect ${out}/source.json`);
const posts=new Map(rows('wp_posts').map(p=>[Number(p.ID),p]));const meta=new Map();
for(const m of rows('wp_postmeta')){const key=`${m.post_id}:${m.meta_key}`;if(!meta.has(key))meta.set(key,[]);meta.get(key).push(m.meta_value);}
const get=(id,key)=>meta.get(`${id}:${key}`)?.[0];
const oldMatches=rows('wp_joomsport_matches'),oldEvents=rows('wp_joomsport_match_events'),oldRosters=rows('wp_joomsport_playerlist'),oldSquads=rows('wp_joomsport_squad'),oldStandings=rows('wp_joomsport_season_table');
const db=new PrismaClient();let current;
try{current=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const models=['season','competition','division','team','teamEntry','player','rosterEntry','classificationCategory','playerClassification','match','matchStage','matchRoster','goal','assist','penalty','legacyMatchEvent','legacyImportMap','standing','teamStatistic','playerStatistic','playerSuspension','venue','penaltyShot'];
  const snapshot={};for(const model of models)snapshot[model]=await tx[model].findMany();return snapshot;
},{timeout:120000});}finally{await db.$disconnect();}
save('current-snapshot.json',current);
const byId=Object.fromEntries(Object.entries(current).map(([k,v])=>[k,new Map(v.map(x=>[x.id,x]))]));
const identity=new Map();
for(const m of current.legacyImportMap.filter(m=>m.source.startsWith('joomsport:lhlnew:'))){const key=`${m.entityType}:${m.legacyId}`;if(!identity.has(key))identity.set(key,new Set());identity.get(key).add(m.entityId);}
const mapping=(type,id)=>{const ids=[...(identity.get(`${type}:${id}`)||[])];return ids.length===1?ids[0]:null;};
const conflicts=[],changes=[],newRows=[],unchanged={},sourceOnly=[],currentOnly=[];
for(const [key,ids] of identity)if(ids.size>1&&!key.startsWith('competition:'))conflicts.push({kind:'ambiguous-mapping',key,ids:[...ids]});
const str=v=>v===null||v===undefined?'':String(v);
const equal=(a,b)=>str(a)===str(b);
function compare(type,oldId,target,desired){
  if(!target){newRows.push({type,legacyId:oldId,desired,approvalRequired:true});return;}
  let count=0;
  for(const [field,value] of Object.entries(desired)){
    if(equal(target[field],value))continue;
    count++;const missing=value===null||value==='';
    changes.push({type,legacyId:oldId,targetId:target.id,field,current:target[field]??null,source:value,decision:missing?'KEEP_CURRENT_SOURCE_EMPTY':'REVIEW',identity:'LegacyImportMap',approvalRequired:true});
  }
  if(!count)unchanged[type]=(unchanged[type]||0)+1;
}
const attachment=id=>{const p=posts.get(Number(id));return p?.post_type==='attachment'?p.guid:null;};
const playerPosts=rows('wp_posts').filter(p=>p.post_type==='joomsport_player'&&p.post_status!=='trash');
const media=[];
for(const p of playerPosts){
  const personal=get(p.ID,'_joomsport_player_personal'),extra=get(p.ID,'_joomsport_player_ef'),value=key=>serializedString(extra,key)||null;
  const photo=attachment(galleryIds(get(p.ID,'vdw_gallery_id'))[0])||(/^https?:\/\//.test(value(15)||'')?value(15):null);
  const target=byId.player.get(mapping('player',p.ID));
  const date=value(1);let birthDate=null;if(/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&date!=='0000-00-00'){const d=new Date(`${date}T00:00:00+03:00`);if(!Number.isNaN(+d))birthDate=d.toISOString();}
  compare('player',p.ID,target?{...target,birthDate:target.birthDate?.toISOString()||null}:null,{firstName:serializedString(personal,'first_name'),lastName:serializedString(personal,'last_name'),patronymic:serializedString(personal,'short_name')||null,nativeName:serializedString(personal,'home_name')||null,birthDate,country:value(2),birthPlace:value(3),position:value(4),stickHand:value(5),heightCm:value(6)?Number(value(6)):null,weightKg:value(7)?Number(value(7)):null,league:value(14),baseNumber:value(8),photoUrl:photo});
  if(target){const rating=byId.classificationCategory.get(target.ratingCategoryId)?.name||null;if(!equal(rating,value(10)))conflicts.push({kind:'current-rating',legacyId:p.ID,targetId:target.id,current:rating,source:value(10),reason:'Profile rating is not evidence for historical seasonal rating'});}
  media.push({type:'player',legacyId:p.ID,url:photo});
}
for(const p of rows('wp_posts').filter(p=>p.post_type==='joomsport_team'&&p.post_status!=='trash')){
  const logo=attachment(get(p.ID,'_thumbnail_id')),photo=attachment(galleryIds(get(p.ID,'vdw_gallery_id'))[0]);
  compare('team',p.ID,byId.team.get(mapping('team',p.ID)),{name:p.post_title,city:serializedString(get(p.ID,'_joomsport_team_ef'),11)||null,logoUrl:logo,teamPhotoUrl:photo});
  media.push({type:'team-logo',legacyId:p.ID,url:logo},{type:'team-photo',legacyId:p.ID,url:photo});
}
const entries=new Map(current.teamEntry.map(e=>[`${e.divisionId}:${e.teamId}`,e]));
const rosterIndex=new Map(current.rosterEntry.map(e=>[`${e.teamEntryId}:${e.playerId}`,e]));
const divisions=[];const allSeasonIds=new Set([...oldMatches.map(m=>Number(m.seasonID)),...oldRosters.map(m=>Number(m.season_id)),...oldStandings.map(m=>Number(m.season_id)),...rows('wp_posts').filter(p=>p.post_type==='joomsport_season').map(p=>Number(p.ID))]);
for(const id of allSeasonIds){
  const p=posts.get(id),target=byId.division.get(mapping('division',id)),comp=byId.competition.get(target?.competitionId),season=byId.season.get(comp?.seasonId);
  const matches=oldMatches.filter(m=>Number(m.seasonID)===id),rosters=oldRosters.filter(m=>Number(m.season_id)===id),standing=oldStandings.filter(m=>Number(m.season_id)===id);
  const targetMatches=current.match.filter(m=>m.divisionId===target?.id),teams=current.teamEntry.filter(t=>t.divisionId===target?.id),teamIds=new Set(teams.map(t=>t.id));
  const dates=matches.map(m=>m.date).filter(d=>d&&d!=='0000-00-00').sort();
  divisions.push({legacyId:id,sourceTitle:p?.post_title,sourceStatus:p?.post_status,targetId:target?.id||null,season:season?.name,competition:comp?.name,division:target?.name,oldMatches:matches.length,currentMatches:targetMatches.length,oldFinal:matches.filter(m=>Number(m.status)===1).length,currentFinal:targetMatches.filter(m=>m.status==='FINAL').length,oldTeams:new Set(standing.map(s=>s.participant_id)).size,currentTeams:teams.length,oldAssignments:rosters.length,currentAssignments:current.rosterEntry.filter(r=>teamIds.has(r.teamEntryId)).length,oldUniquePlayers:new Set(rosters.map(r=>r.player_id)).size,oldEvents:oldEvents.filter(e=>Number(e.season_id)===id).length,firstMatch:dates[0]||null,lastMatch:dates.at(-1)||null});
  if(!target)sourceOnly.push({type:'division',legacyId:id,title:p?.post_title,requiresDecision:true});
}
for(const r of oldRosters){
  const div=mapping('division',r.season_id),team=mapping('team',r.team_id),player=mapping('player',r.player_id),entry=entries.get(`${div}:${team}`),existing=rosterIndex.get(`${entry?.id}:${player}`);
  if(!existing)newRows.push({type:'rosterEntry',legacyId:`${r.season_id}:${r.team_id}:${r.player_id}`,desired:r,unresolved:!entry||!player,approvalRequired:true});
  // Do not propagate the current profile number to historical rosters.
}
for(const m of oldMatches){
  const target=byId.match.get(mapping('match',m.postID)),div=mapping('division',m.seasonID);
  const home=entries.get(`${div}:${mapping('team',m.teamHomeID)}`),away=entries.get(`${div}:${mapping('team',m.teamAwayID)}`);
  let startsAt=null;if(m.date&&m.date!=='0000-00-00'){const time=/^\d{1,2}:\d{2}(?::\d{2})?$/.test(str(m.time))?str(m.time).padStart(5,'0'):'00:00';const d=new Date(`${m.date}T${time.length===5?time+':00':time}+03:00`);if(!Number.isNaN(+d))startsAt=d.toISOString();}
  const desired={divisionId:div,homeTeamEntryId:home?.id||null,awayTeamEntryId:away?.id||null,status:Number(m.status)===1?'FINAL':'SCHEDULED',startsAt,homeScore:m.scoreHome===null||m.scoreHome===''?null:Number(m.scoreHome),awayScore:m.scoreAway===null||m.scoreAway===''?null:Number(m.scoreAway)};
  compare('match',m.postID,target?{...target,startsAt:target.startsAt?.toISOString()||null}:null,desired);
  if(![0,1].includes(Number(m.status)))conflicts.push({kind:'unknown-match-status',legacyId:m.postID,status:m.status});
  if(target?.protocolData||target?.resultType!=='NORMAL'&&target)conflicts.push({kind:'preserve-custom-protocol',legacyId:m.postID,targetId:target.id});
}
const legacyEventById=new Map();for(const e of current.legacyMatchEvent){const key=str(e.legacyId);if(!legacyEventById.has(key))legacyEventById.set(key,[]);legacyEventById.get(key).push(e);}
const eventChanges=[];for(const e of oldEvents){const targetId=mapping('match',e.match_id),candidates=(legacyEventById.get(str(e.id))||[]).filter(c=>c.matchId===targetId);if(candidates.length!==1){eventChanges.push({legacyId:e.id,matchLegacyId:e.match_id,status:candidates.length?'AMBIGUOUS':'NEW',source:e});continue;}
  const c=candidates[0];const expected={eventCode:str(e.e_id),count:Number(e.ecount||1),minute:str(e.minutes_input||e.minutes)||null,reason:str(e.Eventreason)||null,playerId:mapping('player',e.player_id),teamEntryId:entries.get(`${mapping('division',e.season_id)}:${mapping('team',e.t_id)}`)?.id||null,ordering:Number(e.eordering||0),minuteEnd:e.minutes_end||null,additionalTo:Number(e.additional_to||0),stageId:Number(e.stage_id||0)};
  const old={...c,...c.raw};const differences=Object.keys(expected).filter(k=>!equal(old[k],expected[k]));if(differences.length)eventChanges.push({legacyId:e.id,matchLegacyId:e.match_id,targetId:c.id,status:'CHANGED',differences,source:expected,current:Object.fromEntries(Object.keys(expected).map(k=>[k,old[k]]))});
}
const mappedTarget=(type)=>new Set([...identity].filter(([k])=>k.startsWith(type+':')).flatMap(([,v])=>[...v]));
for(const type of ['player','team','match','division'])for(const row of current[type])if(!mappedTarget(type).has(row.id))currentOnly.push({type,id:row.id,reason:'No legacy mapping; preserve'});
const oldIdSets={player:new Set(playerPosts.map(p=>str(p.ID))),team:new Set(rows('wp_posts').filter(p=>p.post_type==='joomsport_team').map(p=>str(p.ID))),match:new Set(oldMatches.map(m=>str(m.postID))),division:new Set([...allSeasonIds].map(str))};
for(const [key,ids] of identity){const split=key.indexOf(':'),type=key.slice(0,split),id=key.slice(split+1);if(oldIdSets[type]&&!oldIdSets[type].has(id))currentOnly.push({type,ids:[...ids],legacyId:id,reason:'Not in final dump; preserve'});}
const manifest=JSON.parse(fs.readFileSync('src/lib/legacy-media-manifest.json','utf8'));
const mediaReport=media.map(m=>{const local=m.url?manifest[m.url]:null;const file=typeof local==='string'?path.resolve('public',local.replace(/^\//,'')):null;return {...m,local:local||null,available:file?file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file):false};});
const statsComparisons=[];for(const s of oldStandings){const entry=entries.get(`${mapping('division',s.season_id)}:${mapping('team',s.participant_id)}`);const stats=current.teamStatistic.find(t=>t.teamEntryId===entry?.id);let parsed;try{parsed=JSON.parse(s.options);}catch{parsed={};}const fields={games:'played_chk',wins:'win_chk',draws:'draw_chk',losses:'lost_chk',goalsFor:'goalscore_chk',goalsAgainst:'goalconc_chk',points:'point_chk'};const differences=Object.entries(fields).filter(([k,v])=>parsed[v]!==undefined&&!equal(stats?.[k],parsed[v])).map(([k,v])=>({field:k,current:stats?.[k]??null,source:parsed[v]}));statsComparisons.push({legacyDivisionId:s.season_id,legacyTeamId:s.participant_id,targetId:entry?.id||null,source:s,current:stats||null,differences,status:differences.length?'DIFFERENT':'MATCHED'});}
save('divisions.json',divisions);save('field-differences.json',changes);save('new-record-candidates.json',newRows);save('conflicts.json',conflicts);save('event-differences.json',eventChanges);save('media.json',mediaReport);save('standings-review.json',statsComparisons);save('current-only.json',currentOnly);
save('source-sport-structure.json',Object.fromEntries([...dump.tables].filter(([k])=>k.startsWith('wp_joomsport_')).map(([k,v])=>[k,{count:v.length,columns:v[0]?Object.keys(v[0]):[]}])));
const countBy=(list,key)=>Object.fromEntries([...new Set(list.map(x=>x[key]))].map(k=>[k,list.filter(x=>x[key]===k).length]));
const summary={checkedAt:new Date().toISOString(),source:path.basename(source),sha256,output:out,workingDatabaseWrites:0,sqlExecuted:false,divisions:divisions.length,mappedDivisions:divisions.filter(d=>d.targetId).length,seasons:[...new Set(divisions.map(d=>d.season).filter(Boolean))],sourceOnly,sourceMatches:oldMatches.length,currentMatches:current.match.length,sourcePlayerProfiles:playerPosts.length,currentPlayers:current.player.length,unchanged,fieldDifferences:countBy(changes,'type'),newCandidates:countBy(newRows,'type'),conflicts:countBy(conflicts,'kind'),eventDifferences:countBy(eventChanges,'status'),media:{references:media.length,missingSource:mediaReport.filter(m=>!m.url).length,localVerified:mediaReport.filter(m=>m.available).length,notMirrored:mediaReport.filter(m=>m.url&&!m.available).length},currentOnly:countBy(currentOnly,'type'),trialImportPerformed:false,notes:['Global profile numbers/ratings are not authoritative historical roster values.','Old importer --replace deletes seasons and is not used.','All differences require review, not automatic overwrite.']};
save('summary.json',summary);console.log(JSON.stringify(summary,null,2));
