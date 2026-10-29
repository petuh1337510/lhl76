import fs from 'node:fs';
import path from 'node:path';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
import {serializedString,galleryIds} from './lib/legacy-2023-24-data.mjs';
const dir=path.resolve(process.argv[2]||'');if(!dir.startsWith(path.resolve('work')+path.sep))throw new Error('Expected private audit directory');
const load=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')),save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2),{flag:'wx'});
const current=load('current-snapshot.json'),dump=await readFinalDump(path.join(dir,'source.sql')),rows=n=>dump.tables.get(n)||[],posts=new Map(rows('wp_posts').map(p=>[Number(p.ID),p]));
const maps=current.legacyImportMap,find=(type,id)=>maps.find(m=>m.entityType===type&&m.legacyId===String(id))?.entityId;
const entries=new Map(current.teamEntry.map(e=>[`${e.divisionId}:${e.teamId}`,e]));
const entry=(division,team)=>entries.get(`${find('division',division)}:${find('team',team)}`);
const roster=new Map(current.rosterEntry.map(r=>[`${r.teamEntryId}:${r.playerId}`,r]));
const stageNames=new Map(rows('wp_terms').map(r=>[Number(r.term_id),r.name]));
const matchedSquads=new Set(),squadDifferences=[],newMatches=load('new-record-candidates.json').filter(r=>r.type==='match');
for(const s of rows('wp_joomsport_squad').filter(r=>String(r.squad_type)==='1')){
  const matchId=find('match',s.match_id),teamEntry=entry(s.season_id,s.team_id),playerId=find('player',s.player_id),r=roster.get(`${teamEntry?.id}:${playerId}`);
  const c=current.matchRoster.find(x=>x.matchId===matchId&&x.rosterEntryId===r?.id);
  if(c)matchedSquads.add(c.id);
  const number=String(s.match_num||'').trim()||null;
  if(!c||String(c.numberOverride||'')!==String(number||''))squadDifferences.push({matchLegacyId:s.match_id,seasonLegacyId:s.season_id,playerLegacyId:s.player_id,teamLegacyId:s.team_id,targetId:c?.id||null,status:c?'NUMBER_DIFFERENT':'NEW',current:c?.numberOverride??null,source:number});
}
const sourceMatchIds=new Set(rows('wp_joomsport_matches').map(m=>find('match',m.postID)).filter(Boolean));
const currentOnlySquads=current.matchRoster.filter(r=>sourceMatchIds.has(r.matchId)&&!matchedSquads.has(r.id));
const duplicateKeys=(items,key)=>{const counts=new Map();for(const row of items){const k=key(row);counts.set(k,(counts.get(k)||0)+1);}return [...counts].filter(([,n])=>n>1).map(([key,count])=>({key,count}));};
const sourceMatchReview=rows('wp_joomsport_matches').filter(m=>newMatches.some(x=>Number(x.legacyId)===Number(m.postID))).map(m=>({legacyId:m.postID,divisionLegacyId:m.seasonID,title:posts.get(Number(m.postID))?.post_title,stageLegacyId:m.mdID,stage:stageNames.get(Number(m.mdID)),homeTeamEntryId:entry(m.seasonID,m.teamHomeID)?.id||null,awayTeamEntryId:entry(m.seasonID,m.teamAwayID)?.id||null,status:m.status,score:[m.scoreHome,m.scoreAway],events:rows('wp_joomsport_match_events').filter(e=>Number(e.match_id)===Number(m.postID)).length,squads:rows('wp_joomsport_squad').filter(s=>Number(s.match_id)===Number(m.postID)&&String(s.squad_type)==='1').length}));
const referencedPlayers=new Set([...rows('wp_joomsport_playerlist'),...rows('wp_joomsport_squad'),...rows('wp_joomsport_match_events')].filter(r=>find('division',r.season_id)).map(r=>Number(r.player_id)));
const newPlayers=load('new-record-candidates.json').filter(r=>r.type==='player').map(p=>({...p,usedInMappedCompetition:referencedPlayers.has(Number(p.legacyId)),sameNameCandidates:current.player.filter(c=>c.firstName===p.desired.firstName&&c.lastName===p.desired.lastName).map(c=>({id:c.id,birthDate:c.birthDate,patronymic:c.patronymic,deletedAt:c.deletedAt}))}));
const meta=new Map(rows('wp_postmeta').map(m=>[`${m.post_id}:${m.meta_key}`,m.meta_value]));
const boxFields=rows('wp_joomsport_box_fields'),boxes=rows('wp_joomsport_box_match').filter(r=>Object.entries(r).some(([k,v])=>k.startsWith('boxfield_')&&v!==null&&v!==''&&Number(v)!==0));
save('squad-differences.json',squadDifferences);save('current-only-squads.json',currentOnlySquads);save('new-match-review.json',sourceMatchReview);save('new-player-review.json',newPlayers);
save('historical-detail-review.json',{boxFields,boxNonzeroRows:boxes.length,boxDataBySeason:[...new Set(boxes.map(r=>r.season_id))].map(id=>({legacyDivision:id,rows:boxes.filter(r=>r.season_id===id).length})),eventTypes:rows('wp_joomsport_events'),extraFields:rows('wp_joomsport_extra_fields'),groups:rows('wp_joomsport_groups'),duplicateRosterKeys:duplicateKeys(rows('wp_joomsport_playerlist'),r=>`${r.season_id}:${r.team_id}:${r.player_id}`),duplicateSquadKeys:duplicateKeys(rows('wp_joomsport_squad').filter(r=>String(r.squad_type)==='1'),r=>`${r.match_id}:${r.team_id}:${r.player_id}`),matchMetaKeys:[...new Set(rows('wp_postmeta').filter(r=>String(r.meta_key).startsWith('_joomsport_match')).map(r=>r.meta_key))],suspensionLikeMetaKeys:[...new Set(rows('wp_postmeta').filter(r=>/suspend|disqual|дисквал/i.test(r.meta_key)).map(r=>r.meta_key))],localSuspensionsPreserved:current.playerSuspension.length});
// Older dump is supporting evidence only, not an assumed baseline of every local edit.
const previousPath=process.argv[3];let threeWay=[];
if(previousPath){
 const previous=await readFinalDump(previousPath),oldPosts=new Map((previous.tables.get('wp_posts')||[]).map(p=>[Number(p.ID),p])),oldMeta=new Map((previous.tables.get('wp_postmeta')||[]).map(m=>[`${m.post_id}:${m.meta_key}`,m.meta_value]));
 const oldMatch=new Map((previous.tables.get('wp_joomsport_matches')||[]).map(m=>[Number(m.postID),m]));
 for(const d of load('field-differences.json')){
   let value,known=true;const p=oldPosts.get(Number(d.legacyId)),get=key=>oldMeta.get(`${d.legacyId}:${key}`),personal=get('_joomsport_player_personal'),extra=get('_joomsport_player_ef');
   if(d.type==='player'){
     const personalKeys={firstName:'first_name',lastName:'last_name',patronymic:'short_name',nativeName:'home_name'},extraKeys={birthDate:1,country:2,birthPlace:3,position:4,stickHand:5,heightCm:6,weightKg:7,baseNumber:8,league:14};
     if(d.field in personalKeys)value=serializedString(personal,personalKeys[d.field])||null;
     else if(d.field in extraKeys){value=serializedString(extra,extraKeys[d.field])||null;if(d.field==='birthDate'&&value&&value!=='0000-00-00')value=new Date(`${value}T00:00:00+03:00`).toISOString();if(['heightCm','weightKg'].includes(d.field)&&value)value=Number(value);}
     else if(d.field==='photoUrl'){const photoId=galleryIds(get('vdw_gallery_id'))[0],direct=serializedString(extra,15);value=oldPosts.get(photoId)?.guid||(/^https?:\/\//.test(direct)?direct:null);}else known=false;
   }else if(d.type==='match'){const m=oldMatch.get(Number(d.legacyId));if(!m)known=false;else if(['homeScore','awayScore'].includes(d.field))value=Number(m[d.field==='homeScore'?'scoreHome':'scoreAway']);else if(d.field==='status')value=Number(m.status)===1?'FINAL':'SCHEDULED';else known=false;}
   else if(d.type==='team'&&d.field==='name')value=p?.post_title;else known=false;
   const eq=(a,b)=>String(a??'')===String(b??'');
   threeWay.push({...d,previous:known?value:null,classification:!known?'NOT_CLASSIFIED':eq(d.current,value)&&!eq(d.source,value)?'SOURCE_CHANGED_CURRENT_MATCHES_PREVIOUS':eq(d.source,value)?'CURRENT_DIFFERS_FROM_BOTH_DUMPS':'BOTH_CHANGED_REVIEW'});
 }
 save('three-way-review.json',{previousSource:path.basename(previousPath),warning:'Supporting evidence; does not prove local provenance',changes:threeWay});
}
const counts=values=>Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]));
const summary={squadDifferences:counts(squadDifferences.map(r=>r.status)),currentOnlySquads:currentOnlySquads.length,newPlayers:newPlayers.length,newPlayersInCompetitions:newPlayers.filter(p=>p.usedInMappedCompetition).length,newPlayersWithNameCandidates:newPlayers.filter(p=>p.sameNameCandidates.length).length,newMatches:sourceMatchReview.length,newMatchesWithTeams:sourceMatchReview.filter(m=>m.homeTeamEntryId&&m.awayTeamEntryId).length,boxNonzeroRows:boxes.length,threeWay:counts(threeWay.map(r=>r.classification)),workingWrites:0};save('deep-summary.json',summary);console.log(JSON.stringify(summary,null,2));
