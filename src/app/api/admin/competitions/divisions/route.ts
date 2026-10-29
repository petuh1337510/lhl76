import {NextResponse} from 'next/server';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {withAdmin} from '@/lib/admin-guard';
import {prisma} from '@/lib/prisma';
import {publicSlug} from '@/lib/division-page';
import {canonicalDivisionName} from '@/lib/historical-division-names';
const name=z.string().trim().min(2).max(100);
const create=z.union([
  z.object({competitionId:z.string().uuid(),names:z.array(name).min(1).max(30)}).strict(),
  z.object({competitionId:z.string().uuid(),name}).strict(),
]);
const edit=z.object({competitionId:z.string().uuid(),id:z.string().uuid(),name,previousName:name}).strict();
export const POST=withAdmin(async request=>{
  const parsed=create.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Выберите дивизионы или укажите название (2–100 символов).'},{status:400});
  const names=('names' in parsed.data?parsed.data.names:[parsed.data.name]).map(canonicalDivisionName);
  if(names.some(n=>!publicSlug(n))||new Set(names.map(publicSlug)).size!==names.length)return NextResponse.json({error:'Названия должны быть различными и содержать буквы или цифры.'},{status:400});
  try{
    const result=await prisma.$transaction(async tx=>{
      const competitionId=parsed.data.competitionId;
      const parent=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Competition" WHERE id = ${competitionId} FOR UPDATE`;
      if(!parent.length)return {error:'Соревнование не найдено.',status:404};
      const existing=await tx.division.findMany({where:{competitionId}});
      if(names.some(n=>existing.some(d=>publicSlug(canonicalDivisionName(d.name))===publicSlug(n)||d.slug===publicSlug(n))))return {error:'Один из выбранных дивизионов уже есть в соревновании.',status:409};
      const items=[];
      for(const [index,divisionName] of names.entries())items.push(await tx.division.create({data:{competitionId,name:divisionName,slug:publicSlug(divisionName),sortOrder:Math.max(-1,...existing.map(d=>d.sortOrder))+1+index,stages:{create:{name:'Регулярный этап',slug:'regular',type:'GROUP_STAGE',countsForStandings:true}}}}));
      return {id:items[0].id,added:items.length};
    });
    return NextResponse.json(result,{status:'status' in result?result.status:201});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return NextResponse.json({error:'Такой дивизион уже есть в соревновании.'},{status:409});throw error}
});
export const PATCH=withAdmin(async request=>{
  const parsed=edit.safeParse(await request.json().catch(()=>null));
  if(!parsed.success||!publicSlug(parsed.data.name))return NextResponse.json({error:'Проверьте название дивизиона.'},{status:400});
  const data={...parsed.data,name:canonicalDivisionName(parsed.data.name)};
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Competition" WHERE id = ${data.competitionId} FOR UPDATE`;
    const siblings=await tx.division.findMany({where:{competitionId:data.competitionId}});
    const current=siblings.find(d=>d.id===data.id);
    if(!current)return {error:'Дивизион не найден в соревновании.',status:404};
    if(current.name!==data.previousName)return {error:'Название уже изменено. Обновите страницу.',status:409};
    if(siblings.some(d=>d.id!==data.id&&(publicSlug(canonicalDivisionName(d.name))===publicSlug(data.name)||publicSlug(d.slug)===publicSlug(data.name))))return {error:'Дивизион с таким названием уже есть.',status:409};
    await tx.division.update({where:{id:data.id},data:{name:data.name}});
    return {ok:true};
  });
  return NextResponse.json(result,{status:'status' in result?result.status:200});
});
