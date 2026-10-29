import fs from 'node:fs';
import path from 'node:path';
import { calculateDivisionStatistics } from '../src/lib/domain/division-statistics';
import { legacyProtocolReview } from '../src/lib/legacy-protocol-review';
const root=path.resolve('work/final-reconciliation-2026-10-29T09-46-37-979Z');
const s=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8'));
const by=(model:string)=>new Map<string,any>(s[model].map((r:any)=>[r.id,r]));
const comps=by('competition'),seasons=by('season'),stages=by('matchStage'),entries=by('teamEntry'),rosters=by('rosterEntry'),matches=by('match');
const tableDifferences:any[]=[],statDifferences:any[]=[],contexts:any[]=[];
for(const d of s.division){const comp=comps.get(d.competitionId),season=seasons.get(comp.seasonId);const relevant=s.match.filter((m:any)=>m.divisionId===d.id&&m.status==='FINAL'&&stages.get(m.stageId)?.countsForStandings);
 const rows=calculateDivisionStatistics(s.teamEntry.filter((r:any)=>r.divisionId===d.id).map((r:any)=>r.id),relevant.map((m:any)=>({home:m.homeTeamEntryId,away:m.awayTeamEntryId,homeGoals:m.homeScore,awayGoals:m.awayScore,homePenaltyMinutes:m.resultType==='TECHNICAL'?0:s.penalty.filter((p:any)=>p.matchId===m.id&&p.teamEntryId===m.homeTeamEntryId).reduce((n:number,p:any)=>n+p.minutes,0),awayPenaltyMinutes:m.resultType==='TECHNICAL'?0:s.penalty.filter((p:any)=>p.matchId===m.id&&p.teamEntryId===m.awayTeamEntryId).reduce((n:number,p:any)=>n+p.minutes,0),technicalWinner:m.resultType==='TECHNICAL'?m.protocolData?.technicalWinnerTeamEntryId??null:null,excludeGoals:m.resultType==='TECHNICAL'})));
 for(const row of rows){const stored=s.teamStatistic.find((r:any)=>r.teamEntryId===row.teamEntryId),standing=s.standing.find((r:any)=>r.teamEntryId===row.teamEntryId);const keys=['games','wins','draws','losses','goalsFor','goalsAgainst','points'] as const;const different=keys.filter(k=>stored?.[k]!==row[k]);if(different.length||standing?.rank!==row.rank||standing?.points!==row.points)tableDifferences.push({divisionId:d.id,season:season.name,division:d.name,teamEntryId:row.teamEntryId,fields:different,rankDifferent:standing?.rank!==row.rank,expected:row,stored,standing});}
 contexts.push({season:season.name,competition:comp.name,division:d.name,matches:s.match.filter((m:any)=>m.divisionId===d.id).length,finalForStandings:relevant.length,teams:rows.length});
}
const totals=new Map<string,any>();const add=(playerId:string,teamEntryId:string,field:string,n:number)=>{const key=playerId+':'+teamEntryId;if(!totals.has(key))totals.set(key,{playerId,teamEntryId,games:0,goals:0,assists:0,penaltyMinutes:0});totals.get(key)[field]+=n;};
const final=(id:string)=>{const m=matches.get(id);return m?.status==='FINAL'&&m.resultType!=='TECHNICAL';};
for(const r of s.matchRoster)if(final(r.matchId)){const e=rosters.get(r.rosterEntryId);add(e.playerId,e.teamEntryId,'games',1);}
for(const g of s.goal)if(final(g.matchId))add(g.scorerId,g.teamEntryId,'goals',1);
for(const a of s.assist)if(final(a.matchId))add(a.playerId,a.teamEntryId,'assists',1);
for(const p of s.penalty)if(final(p.matchId)&&p.playerId)add(p.playerId,p.teamEntryId,'penaltyMinutes',p.minutes);
for(const row of s.playerStatistic){const key=row.playerId+':'+row.teamEntryId,expected=totals.get(key)||{games:0,goals:0,assists:0,penaltyMinutes:0};const fields=['games','goals','assists','penaltyMinutes'].filter(k=>row[k]!==expected[k]);if(fields.length)statDifferences.push({id:row.id,playerId:row.playerId,teamEntryId:row.teamEntryId,divisionId:entries.get(row.teamEntryId)?.divisionId,fields,expected,stored:row});totals.delete(key);}
for(const expected of totals.values())statDifferences.push({missing:true,expected,divisionId:entries.get(expected.teamEntryId)?.divisionId});
const old=JSON.parse(fs.readFileSync(path.join(root,'standings-review.json'),'utf8')).filter((r:any)=>r.targetId&&r.differences.length);
const result={checkedAt:new Date().toISOString(),contexts,tableDifferences,statDifferences,oldStoredTableDifferences:old,heldProtocols:Object.keys(legacyProtocolReview).length,workingWrites:0,goalkeeperImport:false};
fs.writeFileSync(path.join(root,'all-statistics-check.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({divisions:contexts.length,matches:s.match.length,tableDifferences:tableDifferences.length,playerStatisticDifferences:statDifferences.length,oldStoredTableDifferences:old.length,statFields:Object.fromEntries(['games','goals','assists','penaltyMinutes'].map(k=>[k,statDifferences.filter(r=>r.fields?.includes(k)).length]))}));
