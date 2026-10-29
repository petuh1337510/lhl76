import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-guard';
import { prisma } from '@/lib/prisma';
import { calculateStandings } from '@/lib/domain/standings';

export const GET = withAdmin(async request => {
  const seasonId=request.nextUrl.searchParams.get('seasonId');
  const competitionId=request.nextUrl.searchParams.get('competitionId');
  const divisionId=request.nextUrl.searchParams.get('divisionId');
  if(!seasonId||!competitionId)return NextResponse.json({error:'Выберите сезон и соревнование.'},{status:400});
  const competition=await prisma.competition.findFirst({where:{id:competitionId,seasonId},select:{id:true,name:true,season:{select:{id:true,name:true}},divisions:{orderBy:[{sortOrder:'asc'},{name:'asc'}],select:{id:true,name:true}}}});
  if(!competition)return NextResponse.json({error:'Соревнование не найдено в выбранном сезоне.'},{status:404});
  const division=divisionId?competition.divisions.find(d=>d.id===divisionId):competition.divisions[0];
  if(divisionId&&!division)return NextResponse.json({error:'Дивизион не относится к выбранному соревнованию.'},{status:404});
  if(!division)return NextResponse.json({competition,division:null,rows:[]});
  const entries=await prisma.teamEntry.findMany({where:{divisionId:division.id},select:{id:true,team:{select:{name:true}}}});
  const matches=await prisma.match.findMany({where:{divisionId:division.id,status:'FINAL',isPlayoff:false,stage:{countsForStandings:true}},include:{penalties:true}});
  // Same domain calculation and technical-result handling as the public division table.
  const computed=calculateStandings(matches.map(match=>{
    const protocol=match.protocolData&&typeof match.protocolData==='object'?match.protocolData as Record<string,unknown>:{};
    return {home:match.homeTeamEntryId,away:match.awayTeamEntryId,homeGoals:match.homeScore,awayGoals:match.awayScore,
      homePenaltyMinutes:match.penalties.filter(p=>p.teamEntryId===match.homeTeamEntryId).reduce((sum,p)=>sum+p.minutes,0),
      awayPenaltyMinutes:match.penalties.filter(p=>p.teamEntryId===match.awayTeamEntryId).reduce((sum,p)=>sum+p.minutes,0),
      technicalWinner:match.resultType==='TECHNICAL'&&typeof protocol.technicalWinnerTeamEntryId==='string'?protocol.technicalWinnerTeamEntryId:null,
      excludeGoals:match.resultType==='TECHNICAL'};
  }));
  const index=new Map(computed.map((r,i)=>[r.team,i]));
  entries.sort((a,b)=>{
    const ai=index.get(a.id),bi=index.get(b.id);
    if(ai!==undefined&&bi!==undefined)return ai-bi;
    if(ai!==undefined)return -1;if(bi!==undefined)return 1;
    return a.team.name.localeCompare(b.team.name,'ru');
  });
  const rows=entries.map((entry,i)=>({...(computed.find(r=>r.team===entry.id)||{games:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0}),id:entry.id,team:entry.team.name,rank:i+1}));
  return NextResponse.json({competition,division,rows});
});
