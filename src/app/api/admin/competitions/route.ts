import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-guard';
import { createCompetitionInput, editCompetitionInput } from '@/lib/competition-input';
import { publicSlug } from '@/lib/division-page';
import { historicalDivisionNames, canonicalDivisionName } from '@/lib/historical-division-names';

export const GET = withAdmin(async () => {
  const seasons = await prisma.season.findMany({orderBy:[{startsAt:'desc'},{name:'asc'}],select:{id:true,name:true,isActive:true,competitions:{orderBy:[{sortOrder:'asc'},{name:'asc'},{id:'asc'}],select:{id:true,name:true,type:true,sortOrder:true,updatedAt:true,divisions:{orderBy:[{sortOrder:'asc'},{name:'asc'}],select:{id:true,name:true,teamEntries:{select:{id:true,teamId:true,team:{select:{name:true}}},orderBy:{team:{name:'asc'}}},_count:{select:{teamEntries:true,matches:true}}}}}}}});
  const teams = await prisma.team.findMany({where:{deletedAt:null},select:{id:true,name:true,city:true},orderBy:{name:'asc'}});
  const divisionNames = [...new Set([...historicalDivisionNames,...seasons.flatMap(s=>s.competitions.flatMap(c=>c.divisions.map(d=>canonicalDivisionName(d.name))))])].sort((a,b)=>a.localeCompare(b,'ru'));
  return NextResponse.json({seasons,teams,divisionNames});
});

async function save(request:NextRequest) {
  const body=await request.json().catch(()=>null);
  const parsed=request.method==='POST'?createCompetitionInput.safeParse(body):editCompetitionInput.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Проверьте название (2–120 символов), сезон и порядок (0–9999).'},{status:400});
  try {
    const result=await prisma.$transaction(async tx=>{
      const data=parsed.data;
      const existing='id' in data?await tx.competition.findUnique({where:{id:data.id}}):null;
      const seasonId='seasonId' in data?data.seasonId:existing?.seasonId;
      if(!seasonId)return {error:'Соревнование не найдено.',status:404};
      // Serialize duplicate checks and edits within a season.
      const season=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Season" WHERE id = ${seasonId} FOR UPDATE`;
      if(!season.length)return {error:'Сезон не найден.',status:404};
      const siblings=await tx.competition.findMany({where:{seasonId}});
      if(siblings.some(item=>item.id!==existing?.id&&item.name.trim().toLocaleLowerCase('ru')===data.name.toLocaleLowerCase('ru')))return {error:'Соревнование с таким названием уже есть в сезоне.',status:409};
      if('seasonId' in data){
        if(data.type==='CHAMPIONSHIP'&&siblings.some(item=>item.type==='CHAMPIONSHIP'))return {error:'В сезоне уже есть чемпионат. Отредактируйте его или создайте турнир.',status:409};
        const slug=publicSlug(data.name);
        if(!slug||(data.type==='TOURNAMENT'&&slug==='championship'))return {error:'Выберите другое название соревнования.',status:400};
        const item=await tx.competition.create({data:{...data,slug,sortOrder:Math.max(-1,...siblings.map(s=>s.sortOrder))+1}});
        return {id:item.id};
      }
      const updated=await tx.competition.updateMany({where:{id:data.id,updatedAt:new Date(data.updatedAt)},data:{name:data.name,sortOrder:data.sortOrder}});
      if(!updated.count)return {error:'Данные изменены другим редактором. Обновите список перед сохранением.',status:409};
      return {id:data.id};
    });
    return NextResponse.json(result,{status:'error' in result?result.status:request.method==='POST'?201:200});
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({error:'Название или адрес уже используется в сезоне.'},{status:409});
    throw error;
  }
}
export const POST=withAdmin(save);
export const PATCH=withAdmin(save);
