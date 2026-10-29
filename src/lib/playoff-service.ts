import 'server-only';
import { Prisma } from '@prisma/client';
import { seriesResult } from './domain/playoff';

export class PlayoffConflict extends Error {name='PlayoffConflict'}
export const playoffInclude={division:{select:{name:true}},rounds:{orderBy:{sortOrder:'asc' as const},include:{series:{orderBy:[{sortOrder:'asc' as const},{id:'asc' as const}],include:{homeTeamEntry:{include:{team:true}},awayTeamEntry:{include:{team:true}},matches:{orderBy:{playoffGame:'asc' as const}}}}}}};
export type PlayoffRecord=Prisma.PlayoffGetPayload<{include:typeof playoffInclude}>;
export function playoffView(playoff:PlayoffRecord){
  const results=new Map<string,ReturnType<typeof seriesResult>>();
  const sources=new Map(playoff.rounds.flatMap(r=>r.series.map(s=>[s.id,`${r.name}, пара ${s.sortOrder+1}`] as const)));
  return {id:playoff.id,name:playoff.name,divisionName:playoff.division.name,published:playoff.published,revision:playoff.revision,rounds:playoff.rounds.map(round=>({id:round.id,name:round.name,series:round.series.map(s=>{
    let result;let conflict:string|null=null;
    const resolved=[s.sourceHomeId,s.sourceAwayId].filter((id):id is string=>!!id).every(id=>!!results.get(id)?.winner);
    try{result=seriesResult(s.homeTeamEntryId,s.awayTeamEntryId,s.bestOf,s.matches,resolved&&!!s.homeTeamEntryId!==!!s.awayTeamEntryId)}catch(e){conflict=e instanceof Error?e.message:'Конфликт серии';result={homeWins:0,awayWins:0,target:Math.floor(s.bestOf/2)+1,winner:null,loser:null,bye:false}}
    results.set(s.id,result);
    const placeholder=(id:string|null)=>id?`${s.sourceOutcome==='LOSER'?'Проигравший':'Победитель'}: ${sources.get(id)||'предыдущая серия'}`:'Без соперника';
    return {id:s.id,...result,conflict,number:s.sortOrder+1,homePlaceholder:placeholder(s.sourceHomeId),awayPlaceholder:placeholder(s.sourceAwayId),home:s.homeTeamEntry?{id:s.homeTeamEntry.id,name:s.homeTeamEntry.team.name,logo:s.homeTeamEntry.team.logoUrl}:null,away:s.awayTeamEntry?{id:s.awayTeamEntry.id,name:s.awayTeamEntry.team.name,logo:s.awayTeamEntry.team.logoUrl}:null,sourceOutcome:s.sourceOutcome,dependent:!!(s.sourceHomeId||s.sourceAwayId),matches:s.matches.map(m=>{
      let winnerName:string|null=null;
      if(m.status==='FINAL')try{const winner=seriesResult(s.homeTeamEntryId,s.awayTeamEntryId,1,[m]).winner;winnerName=winner===s.homeTeamEntryId?s.homeTeamEntry?.team.name||null:winner===s.awayTeamEntryId?s.awayTeamEntry?.team.name||null:null}catch{/* Invalid historic result must not invent a winner. */}
      return {id:m.id,slug:m.slug,number:m.playoffGame,status:m.status,resultType:m.resultType,homeScore:m.homeScore,awayScore:m.awayScore,winnerName,startsAt:m.startsAt?.toISOString()||null};
    })};
  })}))};
}
export type PlayoffView=ReturnType<typeof playoffView>;
/** Called inside the protocol transaction after saving its result; conflicts roll back everything. */
export async function syncPlayoff(tx:Prisma.TransactionClient,playoffId:string){
  const playoff=await tx.playoff.findUniqueOrThrow({where:{id:playoffId},include:playoffInclude});
  const results=new Map<string,ReturnType<typeof seriesResult>>();
  for(const round of playoff.rounds)for(const s of round.series){
    const outcome=(id:string|null)=>id?(s.sourceOutcome==='LOSER'?results.get(id)?.loser:results.get(id)?.winner)||null:null;
    const home=s.sourceHomeId?outcome(s.sourceHomeId):s.homeTeamEntryId;
    const away=s.sourceAwayId?outcome(s.sourceAwayId):s.awayTeamEntryId;
    if(home!==s.homeTeamEntryId||away!==s.awayTeamEntryId){
      if(s.matches.some(m=>m.status!=='CANCELLED'))throw new PlayoffConflict('Изменение меняет участников следующего раунда, где уже создан матч. Результат не сохранён: сначала проверьте и явно отмените зависимые матчи через их протоколы.');
      await tx.playoffSeries.update({where:{id:s.id},data:{homeTeamEntryId:home,awayTeamEntryId:away}});
    }
    const resolved=[s.sourceHomeId,s.sourceAwayId].filter((id):id is string=>!!id).every(id=>!!results.get(id)?.winner);
    try{results.set(s.id,seriesResult(home,away,s.bestOf,s.matches,resolved&&!!home!==!!away))}catch(e){throw new PlayoffConflict(e instanceof Error?e.message:'Конфликт серии')}
  }
  await tx.playoff.update({where:{id:playoffId},data:{revision:{increment:1}}});
}
