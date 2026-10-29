import {NextResponse} from 'next/server';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {withAdmin} from '@/lib/admin-guard';
import {prisma} from '@/lib/prisma';
import {playoffInclude,playoffView,syncPlayoff,PlayoffConflict} from '@/lib/playoff-service';
import {seriesResult} from '@/lib/domain/playoff';
const uuid=z.string().uuid();
const context=z.object({seasonId:uuid,competitionId:uuid,divisionId:uuid});
const setup={slots:z.array(uuid.nullable()).refine(s=>[2,4,8].includes(s.length),'Нужны 2, 4 или 8 мест'),targets:z.array(z.number().int().min(1).max(4)).min(1).max(3),bronze:z.boolean(),bronzeTarget:z.number().int().min(1).max(4)};
const input=z.discriminatedUnion('action',[
  context.extend({action:z.literal('create'),...setup}).strict(),
  context.extend({action:z.literal('publish'),id:uuid,revision:z.number().int(),published:z.boolean()}).strict(),
  context.extend({action:z.literal('configure'),id:uuid,revision:z.number().int(),slots:setup.slots,targets:setup.targets,bronzeTarget:setup.bronzeTarget}).strict(),
  context.extend({action:z.literal('match'),id:uuid,revision:z.number().int(),seriesId:uuid}).strict(),
  context.extend({action:z.literal('target'),id:uuid,revision:z.number().int(),seriesId:uuid,target:z.number().int().min(1).max(4)}).strict(),
  context.extend({action:z.literal('attach'),id:uuid,revision:z.number().int(),seriesId:uuid,matchIds:z.array(uuid).min(1).max(7).refine(ids=>new Set(ids).size===ids.length)}).strict(),
]);
export const GET=withAdmin(async request=>{
  const parsed=context.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({error:'Выберите сезон, соревнование и дивизион.'},{status:400});
  const c=parsed.data;
  const division=await prisma.division.findFirst({where:{id:c.divisionId,competitionId:c.competitionId,competition:{seasonId:c.seasonId}},include:{competition:{include:{season:true}},teamEntries:{include:{team:true},orderBy:{team:{name:'asc'}}},playoffs:{include:playoffInclude}}});
  if(!division)return NextResponse.json({error:'Дивизион не найден в выбранном соревновании.'},{status:404});
  const availableMatches=await prisma.match.findMany({where:{divisionId:c.divisionId,isPlayoff:true,status:'FINAL',playoffSeriesId:null},orderBy:[{startsAt:'asc'},{id:'asc'}],select:{id:true,homeTeamEntryId:true,awayTeamEntryId:true,homeScore:true,awayScore:true,startsAt:true,resultType:true,homeTeamEntry:{select:{team:{select:{name:true}}}},awayTeamEntry:{select:{team:{select:{name:true}}}}}});
  return NextResponse.json({context:{...c,season:division.competition.season.name,competition:division.competition.name,division:division.name},teams:division.teamEntries.map(e=>({id:e.id,name:e.team.name})),playoffs:division.playoffs.map(playoffView),availableMatches});
});
export const POST=withAdmin(async request=>{
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Проверьте участников, число побед и выбранный дивизион.'},{status:400});
  const b=parsed.data;
  try{
    const result=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${b.divisionId}))`;
      const division=await tx.division.findFirst({where:{id:b.divisionId,competitionId:b.competitionId,competition:{seasonId:b.seasonId}}});
      if(!division)throw new PlayoffConflict('Дивизион не относится к выбранному соревнованию.');
      if(b.action==='create'||b.action==='configure'){
        const ids=b.slots.filter((s):s is string=>!!s);
        if(new Set(ids).size!==ids.length||ids.length<2||b.slots.some((s,i)=>i%2===0&&!s&&!b.slots[i+1]))throw new PlayoffConflict('Выберите минимум две разные команды. Пара не может быть полностью пустой.');
        if(await tx.teamEntry.count({where:{id:{in:ids},divisionId:b.divisionId}})!==ids.length)throw new PlayoffConflict('Участники должны быть из этого дивизиона.');
        if(b.targets.length!==Math.log2(b.slots.length))throw new PlayoffConflict('Укажите число побед для каждого раунда.');
        if(b.action==='create'&&b.bronze&&(ids.length<3||b.slots.length===2))throw new PlayoffConflict('Для третьего места нужны минимум три участника и полуфиналы.');
      }
      if(b.action==='create'){
        if(await tx.playoff.count({where:{divisionId:b.divisionId}}))throw new PlayoffConflict('В дивизионе уже есть сетка. Откройте её настройки.');
        const playoff=await tx.playoff.create({data:{divisionId:b.divisionId,name:'Плей-офф'}});
        let previous:string[]=[];let semifinal:string[]=[];
        for(let r=0;r<b.targets.length;r++){
          const count=b.slots.length/(2**(r+1));
          const round=await tx.playoffRound.create({data:{playoffId:playoff.id,name:count===4?'¼ финала':count===2?'½ финала':'Финал',sortOrder:r}});
          const current:string[]=[];
          for(let i=0;i<count;i++){
            const series=await tx.playoffSeries.create({data:{roundId:round.id,sortOrder:i,bestOf:b.targets[r]*2-1,...(r===0?{homeTeamEntryId:b.slots[i*2],awayTeamEntryId:b.slots[i*2+1]}:{sourceHomeId:previous[i*2],sourceAwayId:previous[i*2+1]})}});
            current.push(series.id);
          }
          if(count===2)semifinal=current;previous=current;
        }
        if(b.bronze&&semifinal.length){
          const round=await tx.playoffRound.create({data:{playoffId:playoff.id,name:'За 3-е место',sortOrder:b.targets.length}});
          await tx.playoffSeries.create({data:{roundId:round.id,sortOrder:0,bestOf:b.bronzeTarget*2-1,sourceHomeId:semifinal[0],sourceAwayId:semifinal[1],sourceOutcome:'LOSER'}});
        }
        await syncPlayoff(tx,playoff.id);return {ok:true,id:playoff.id};
      }
      const playoff=await tx.playoff.findFirst({where:{id:b.id,divisionId:b.divisionId},include:playoffInclude});
      if(!playoff||playoff.revision!==b.revision)throw new PlayoffConflict('Сетка уже изменена. Обновите страницу перед действием.');
      if(b.action==='configure'){
        if(playoff.published||playoff.rounds.some(r=>r.series.some(s=>s.matches.length)))throw new PlayoffConflict('Участников и формат можно менять только в черновике до создания матчей.');
        const main=playoff.rounds.filter(r=>r.series.every(s=>s.sourceOutcome==='WINNER'));
        if(!main.length||main[0].series.length*2!==b.slots.length||main.length!==b.targets.length)throw new PlayoffConflict('Размер созданной сетки изменять нельзя.');
        for(const [index,round]of playoff.rounds.entries())for(const [i,s]of round.series.entries())await tx.playoffSeries.update({where:{id:s.id},data:{bestOf:(s.sourceOutcome==='LOSER'?b.bronzeTarget:b.targets[index])*2-1,...(index===0?{homeTeamEntryId:b.slots[i*2],awayTeamEntryId:b.slots[i*2+1]}:{})}});
        await syncPlayoff(tx,playoff.id);return {ok:true};
      }
      if(b.action==='publish'){
        await syncPlayoff(tx,playoff.id);
        await tx.playoff.update({where:{id:playoff.id},data:{published:b.published}});return {ok:true};
      }
      const series=playoff.rounds.flatMap(r=>r.series).find(s=>s.id===b.seriesId);
      if(b.action==='target'){
        if(!series)throw new PlayoffConflict('Серия не найдена.');
        try{seriesResult(series.homeTeamEntryId,series.awayTeamEntryId,b.target*2-1,series.matches)}catch(e){throw new PlayoffConflict(e instanceof Error?e.message:'Формат несовместим с результатами.')}
        await tx.playoffSeries.update({where:{id:series.id},data:{bestOf:b.target*2-1}});
        await syncPlayoff(tx,playoff.id);
        return {ok:true};
      }
      if(!series||!series.homeTeamEntryId||!series.awayTeamEntryId)throw new PlayoffConflict('Сначала должны определиться обе команды серии.');
      const state=seriesResult(series.homeTeamEntryId,series.awayTeamEntryId,series.bestOf,series.matches);
      if(state.winner)throw new PlayoffConflict('Серия уже завершена.');
      if(series.matches.some(m=>m.status!=='FINAL'&&m.status!=='CANCELLED'))throw new PlayoffConflict('В серии уже есть незавершённый матч. Сначала заполните его протокол.');
      if(b.action==='attach'){
        const matches=await tx.match.findMany({where:{id:{in:b.matchIds},divisionId:b.divisionId,isPlayoff:true,status:'FINAL',playoffSeriesId:null,OR:[{homeTeamEntryId:series.homeTeamEntryId,awayTeamEntryId:series.awayTeamEntryId},{homeTeamEntryId:series.awayTeamEntryId,awayTeamEntryId:series.homeTeamEntryId}]},orderBy:[{startsAt:'asc'},{id:'asc'}]});
        if(matches.length!==b.matchIds.length)throw new PlayoffConflict('Можно привязать только завершённые матчи плей-офф этих команд из этого дивизиона, ещё не связанные с серией. Обновите страницу.');
        const latest=series.matches.filter(m=>m.status!=='CANCELLED'&&m.startsAt).reduce((max,m)=>Math.max(max,m.startsAt!.getTime()),0);
        if(matches.some(m=>m.startsAt&&m.startsAt.getTime()<latest))throw new PlayoffConflict('Добавляйте матчи по хронологии: выбранный матч сыгран раньше уже привязанного.');
        // Validate the entire selection before writing; do not rebuild player statistics or protocols.
        try{seriesResult(series.homeTeamEntryId,series.awayTeamEntryId,series.bestOf,[...series.matches,...matches])}catch(e){throw new PlayoffConflict(e instanceof Error?e.message:'Проверьте результаты выбранных матчей.')}
        let number=Math.max(0,...series.matches.map(m=>m.playoffGame||0));
        for(const match of matches){
          const updated=await tx.match.updateMany({where:{id:match.id,playoffSeriesId:null,updatedAt:match.updatedAt},data:{playoffSeriesId:series.id,playoffGame:++number}});
          if(updated.count!==1)throw new PlayoffConflict('Матч уже изменён. Обновите страницу.');
        }
        await syncPlayoff(tx,playoff.id);
        return {ok:true,attached:matches.length};
      }
      const stage=await tx.matchStage.upsert({where:{divisionId_slug:{divisionId:b.divisionId,slug:'managed-playoff'}},create:{divisionId:b.divisionId,name:'Плей-офф',slug:'managed-playoff',type:'PLAYOFF',countsForStandings:false},update:{countsForStandings:false}});
      const number=Math.max(0,...series.matches.map(m=>m.playoffGame||0))+1;
      const match=await tx.match.create({data:{slug:'playoff-'+randomUUID(),divisionId:b.divisionId,stageId:stage.id,homeTeamEntryId:series.homeTeamEntryId,awayTeamEntryId:series.awayTeamEntryId,isPlayoff:true,playoffSeriesId:series.id,playoffGame:number}});
      await tx.playoff.update({where:{id:playoff.id},data:{revision:{increment:1}}});return {ok:true,slug:match.slug};
    },{timeout:20000});
    return NextResponse.json(result);
  }catch(e){if(e instanceof PlayoffConflict)return NextResponse.json({error:e.message},{status:409});throw e}
});
