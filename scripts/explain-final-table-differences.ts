import fs from 'node:fs';
import path from 'node:path';
import {calculateDivisionStatistics} from '../src/lib/domain/division-statistics';
import {readFinalDump} from './lib/final-legacy-reader.mjs';
async function main(){
 const root=path.resolve('work/final-reconciliation-2026-10-29T09-46-37-979Z');
 const s=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8')),audit=JSON.parse(fs.readFileSync(path.join(root,'all-statistics-check.json'),'utf8'));
 const dump=await readFinalDump(path.join(root,'source.sql')),oldMatches=dump.tables.get('wp_joomsport_matches')||[];
 const maps=new Map(s.legacyImportMap.filter((m:any)=>m.entityType==='match').map((m:any)=>[m.entityId,m.legacyId]));
 const stages=new Map(s.matchStage.map((m:any)=>[m.id,m]));
 const fields:any={games:'played_chk',wins:'win_chk',draws:'draw_chk',losses:'lost_chk',goalsFor:'goalscore_chk',goalsAgainst:'goalconc_chk',points:'point_chk'};
 const results=[];
 for(const issue of audit.oldStoredTableDifferences){const entry=s.teamEntry.find((e:any)=>e.id===issue.targetId),options=JSON.parse(issue.source.options),ms=s.match.filter((m:any)=>m.divisionId===entry.divisionId&&m.status==='FINAL');const matched=[];
  for(const mode of ['all-final','standings-stages','group-only']){
   const filtered=ms.filter((m:any)=>mode==='all-final'||(mode==='standings-stages'?(stages.get(m.stageId) as any)?.countsForStandings:(stages.get(m.stageId) as any)?.type==='GROUP_STAGE'));
   const calculated=calculateDivisionStatistics(s.teamEntry.filter((e:any)=>e.divisionId===entry.divisionId).map((e:any)=>e.id),filtered.map((m:any)=>{const old=oldMatches.find((o:any)=>String(o.postID)===maps.get(m.id));return {home:m.homeTeamEntryId,away:m.awayTeamEntryId,homeGoals:Number(old?.scoreHome??m.homeScore),awayGoals:Number(old?.scoreAway??m.awayScore)};}));
   const row=calculated.find(r=>r.teamEntryId===entry.id)!;if(Object.entries(fields).every(([k,v])=>options[v as string]===undefined||Number(options[v as string])===row[k as keyof typeof row]))matched.push(mode);
  }
  results.push({legacyDivisionId:issue.legacyDivisionId,legacyTeamId:issue.legacyTeamId,matchedSourceVariants:matched,technicalResultInDivision:ms.some((m:any)=>m.resultType==='TECHNICAL')});
 }
 fs.writeFileSync(path.join(root,'old-table-explanations.json'),JSON.stringify(results,null,2),{flag:'wx'});
 console.log(JSON.stringify({rows:results.length,matched:results.filter(r=>r.matchedSourceVariants.length).length,unexplained:results.filter(r=>!r.matchedSourceVariants.length),variants:results}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
