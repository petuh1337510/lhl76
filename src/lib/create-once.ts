import {createHash} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {currentSession} from './auth';
import {WriteConflict} from './edit-version';
export async function createOnce(kind:'player'|'team',key:unknown,body:unknown,create:(tx:Prisma.TransactionClient)=>Promise<{id:string}>) {
 if(typeof key!=='string'||!/^\w{8}-(?:\w{4}-){3}\w{12}$/.test(key))throw new WriteConflict();
 const actor=await currentSession();if(!actor)throw new Error('Session required');
 const id='idem:'+createHash('sha256').update(actor.userId+':'+kind+':'+key).digest('hex');
 const hash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
  const previous=await tx.auditLog.findUnique({where:{id}});
  if(previous){const saved=previous.after as {id:string;hash:string};if(saved.hash!==hash)throw new WriteConflict();return kind==='player'?tx.player.findUniqueOrThrow({where:{id:saved.id}}):tx.team.findUniqueOrThrow({where:{id:saved.id}})}
  const result=await create(tx);
  await tx.auditLog.create({data:{id,userId:actor.userId,entityType:kind,entityId:result.id,action:'CREATE_ONCE',after:{id:result.id,hash}}});
  return result;
 });
}
