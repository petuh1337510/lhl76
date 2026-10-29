import {NextRequest,NextResponse} from 'next/server';
import {hashPassword,setSessionCookie} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {sameOriginMutation} from '@/lib/security-policy';
import {readBounded,consumeLimit,clientKey} from '@/lib/request-limits';
const enabled=()=>process.env.NODE_ENV!=='production'||process.env.ALLOW_ADMIN_SETUP==='1';
export async function GET(){return NextResponse.json({available:enabled()&&await prisma.user.count()===0});}
export async function POST(request:NextRequest){
 if(!sameOriginMutation(request.headers.get('origin'),request.url,request.headers.get('sec-fetch-site'),request.headers.get('host')))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});
 if(!enabled()||await prisma.user.count())return NextResponse.json({error:'Первичная настройка закрыта'},{status:409});
 if(!await consumeLimit('setup:'+clientKey(request),5,300000))return NextResponse.json({error:'Повторите позже'},{status:429});
 try{
  const b=JSON.parse((await readBounded(request,8192)).toString());
  if(typeof b.email!=='string'||b.email.length>254||!b.email.includes('@')||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||typeof b.password!=='string'||b.password.length<10||b.password.length>256)return NextResponse.json({error:'Проверьте имя, email и пароль (10–256 символов)'},{status:400});
  const passwordHash=await hashPassword(b.password);
  const user=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(76001)`;
   if(await tx.user.count())throw new Error('SETUP_CLOSED');
   return tx.user.create({data:{email:b.email.trim().toLowerCase(),name:b.name.trim(),role:'SUPER_ADMIN',passwordHash}});
  });
  await setSessionCookie({userId:user.id,email:user.email,name:user.name,role:user.role});return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Не удалось завершить первичную настройку'},{status:400});}
}
