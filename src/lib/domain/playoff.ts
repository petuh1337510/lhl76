export type SeriesGame={id:string;status:string;homeTeamEntryId:string;awayTeamEntryId:string;homeScore:number;awayScore:number;resultType:string;protocolData:unknown};
export function seriesResult(home:string|null,away:string|null,bestOf:number,games:SeriesGame[],bye=false){
  const target=Math.floor(bestOf/2)+1;
  let homeWins=0,awayWins=0;
  for(const game of games){
    if(game.status!=='FINAL')continue;
    if(!home||!away||![home,away].includes(game.homeTeamEntryId)||![home,away].includes(game.awayTeamEntryId)||game.homeTeamEntryId===game.awayTeamEntryId)throw Error('Матч не соответствует участникам серии.');
    if(homeWins>=target||awayWins>=target)throw Error('В серии есть завершённый матч после достижения нужного числа побед.');
    const protocol=game.protocolData as {technicalWinnerTeamEntryId?:string}|null;
    const winner=game.resultType==='TECHNICAL'?protocol?.technicalWinnerTeamEntryId:game.homeScore===game.awayScore?null:game.homeScore>game.awayScore?game.homeTeamEntryId:game.awayTeamEntryId;
    if(!winner||![home,away].includes(winner))throw Error('В завершённом матче плей-офф должен быть определён победитель.');
    if(winner===home)homeWins++;else awayWins++;
  }
  const winner=homeWins>=target?home:awayWins>=target?away:bye?(home||away):null;
  return {homeWins,awayWins,target,winner,loser:winner&&home&&away?(winner===home?away:home):null,bye:!!(bye&&winner)};
}
