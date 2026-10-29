import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('work/final-reconciliation-2026-10-29T05-52-30-265Z');
const source=path.join(root,'approved-delta-1793255266680.json');
const plan=JSON.parse(fs.readFileSync(source,'utf8')),baseline=JSON.parse(fs.readFileSync(path.join(root,'current-snapshot.json'),'utf8'));
const review=JSON.parse(fs.readFileSync(path.join(root,'clean-rehearsal/match-trial-plan-1793254357226.json'),'utf8'));
const mappings=[...baseline.legacyImportMap,...plan.models.legacyImportMap.create];
const held=new Set(review.warnings.filter(w=>w.kind==='local-only-events-held').map(w=>w.matchId));
for(const warning of review.warnings.filter(w=>w.kind==='score-vs-goals')){const map=mappings.find(m=>m.entityType==='match'&&m.legacyId===String(warning.legacyId));if(!map)throw new Error('Missing held match mapping');held.add(map.entityId);}
for(const model of ['goal','assist','penalty','legacyMatchEvent']){
 plan.models[model].create=plan.models[model].create.filter(r=>!held.has(r.matchId));
 plan.models[model].update=plan.models[model].update.filter(r=>!held.has(r.after.matchId));
}
for(const row of plan.models.match.update)if(held.has(row.id))row.fields=row.fields.filter(k=>!['periodScores','protocolData'].includes(k));
plan.models.match.update=plan.models.match.update.filter(r=>r.fields.length);
for(const row of plan.models.match.create)if(held.has(row.id)){row.protocolData=null;row.periodScores=null;}
const after=model=>{const delta=plan.models[model]||{create:[],update:[]},updates=new Map(delta.update.map(r=>[r.id,r]));return [...baseline[model].map(old=>{const change=updates.get(old.id);return change?{...old,...Object.fromEntries(change.fields.map(k=>[k,change.after[k]]))}:old;}),...delta.create];};
const entries=new Map(after('rosterEntry').map(r=>[r.id,r]));
const affectedDivisions=new Set(review.affectedDivisions);
const matches=new Map(after('match').filter(m=>affectedDivisions.has(m.divisionId)&&m.status==='FINAL'&&m.resultType!=='TECHNICAL').map(m=>[m.id,m]));
const totals=new Map();
const add=(playerId,teamEntryId,field,n)=>{const key=`${playerId}:${teamEntryId}`;if(!totals.has(key))totals.set(key,{games:0,goals:0,assists:0,penaltyMinutes:0});totals.get(key)[field]+=n;};
for(const r of after('matchRoster'))if(matches.has(r.matchId)){const entry=entries.get(r.rosterEntryId);add(entry.playerId,entry.teamEntryId,'games',1);}
for(const r of after('goal'))if(matches.has(r.matchId))add(r.scorerId,r.teamEntryId,'goals',1);
for(const r of after('assist'))if(matches.has(r.matchId))add(r.playerId,r.teamEntryId,'assists',1);
for(const r of after('penalty'))if(matches.has(r.matchId)&&r.playerId)add(r.playerId,r.teamEntryId,'penaltyMinutes',r.minutes);
const statisticFields=['games','goals','assists','penaltyMinutes'];
for(const item of plan.models.playerStatistic.update){const desired=totals.get(`${item.after.playerId}:${item.after.teamEntryId}`)||{games:0,goals:0,assists:0,penaltyMinutes:0};for(const field of statisticFields)item.after[field]=desired[field];item.fields=statisticFields.filter(k=>item.before[k]!==item.after[k]);}
plan.models.playerStatistic.update=plan.models.playerStatistic.update.filter(r=>r.fields.length);
for(const row of plan.models.playerStatistic.create)Object.assign(row,totals.get(`${row.playerId}:${row.teamEntryId}`)||{games:0,goals:0,assists:0,penaltyMinutes:0});
plan.heldProtocolMatchIds=[...held];plan.protectedModels=['playerClassification','playerSuspension','user','session','auditLog'];
plan.summary=Object.fromEntries(Object.entries(plan.models).map(([model,d])=>[model,{create:d.create.length,update:d.update.length,fields:[...new Set(d.update.flatMap(r=>r.fields))]}]));
const output=path.join(root,`working-approved-plan-${Date.now()}.json`),bytes=JSON.stringify(plan,null,2);fs.writeFileSync(output,bytes,{flag:'wx'});
console.log(JSON.stringify({output,sha256:createHash('sha256').update(bytes).digest('hex'),heldProtocols:held.size,summary:plan.summary},null,2));
