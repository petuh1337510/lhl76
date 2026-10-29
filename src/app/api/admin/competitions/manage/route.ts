import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/admin-guard';

const uuid = z.string().uuid();
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), id: uuid, name: z.string(), updatedAt: z.string().datetime() }).strict(),
  z.object({ action: z.literal('reorder'), seasonId: uuid, items: z.array(z.object({id: uuid, updatedAt: z.string().datetime()}).strict()).min(1).max(200) }).strict(),
  z.object({ action: z.literal('teams'), competitionId: uuid, divisionId: uuid, teamIds: z.array(uuid).min(1).max(100) }).strict(),
]);
export const POST = withAdmin(async request => {
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:'Некорректные параметры действия.'}, {status:400});
  const data = parsed.data;
  const result = await prisma.$transaction(async tx => {
    if (data.action === 'reorder') {
      await tx.$queryRaw`SELECT id FROM "Season" WHERE id = ${data.seasonId} FOR UPDATE`;
      const current = await tx.competition.findMany({where:{seasonId:data.seasonId}});
      if (new Set(data.items.map(i=>i.id)).size !== data.items.length || current.length !== data.items.length || current.some(c=>!data.items.some(i=>i.id===c.id && i.updatedAt===c.updatedAt.toISOString())))
        return {error:'Список изменился. Обновите страницу и повторите.',status:409};
      for (const [sortOrder,item] of data.items.entries()) await tx.competition.update({where:{id:item.id},data:{sortOrder}});
      return {ok:true};
    }
    const competitionId = data.action === 'delete' ? data.id : data.competitionId;
    const parent = await tx.competition.findUnique({where:{id:competitionId}});
    if (!parent) return {error:'Соревнование не найдено.',status:404};
    // Same lock order as competition edits/reordering; child locks block new FK references.
    await tx.$queryRaw`SELECT id FROM "Season" WHERE id = ${parent.seasonId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "Competition" WHERE id = ${competitionId} FOR UPDATE`;
    if (data.action === 'teams') {
      await tx.$queryRaw`SELECT id FROM "Division" WHERE id = ${data.divisionId} FOR UPDATE`;
      const division = await tx.division.findFirst({where:{id:data.divisionId,competitionId}});
      if (!division) return {error:'Дивизион не относится к выбранному соревнованию.',status:400};
      const teamIds = [...new Set(data.teamIds)];
      if (await tx.team.count({where:{id:{in:teamIds},deletedAt:null}}) !== teamIds.length)
        return {error:'Одна из команд недоступна. Обновите список.',status:400};
      const added = await tx.teamEntry.createMany({data:teamIds.map(teamId=>({teamId,divisionId:division.id})),skipDuplicates:true});
      return {ok:true,added:added.count};
    }
    const fresh = await tx.competition.findUnique({where:{id:data.id}});
    if (!fresh || fresh.name!==data.name || fresh.updatedAt.toISOString()!==data.updatedAt)
      return {error:'Название или настройки изменились. Обновите страницу.',status:409};
    await tx.$queryRaw`SELECT id FROM "Division" WHERE "competitionId" = ${data.id} FOR UPDATE`;
    const divisions = await tx.division.findMany({where:{competitionId:data.id},include:{_count:{select:{teamEntries:true,matches:true,standings:true,playoffs:true}}}});
    if (divisions.some(d=>Object.values(d._count).some(n=>n>0)))
      return {error:'Удаление запрещено: есть команды, заявки, матчи, таблицы или плей-офф. Их данные должны быть сохранены.',status:409};
    // Only an empty competition and its empty division/stage containers can be removed.
    await tx.competition.delete({where:{id:data.id}});
    return {ok:true};
  });
  return NextResponse.json(result,{status:'status' in result ? result.status : 200});
});
