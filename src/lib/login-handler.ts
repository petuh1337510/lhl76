import {NextRequest,NextResponse} from 'next/server';
import {setSessionCookie,verifyPassword,hashPassword} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {clientKey,consumeLimit,readBounded} from '@/lib/request-limits';
import {sameOriginMutation} from '@/lib/security-policy';
import {securityEvent} from '@/lib/security-events';
const dummy=hashPassword('not-a-real-user-password');
export async function login(request:NextRequest){
 if(!sameOriginMutation(request.headers.get('origin'),request.url,request.headers.get('sec-fetch-site'),request.headers.get('host')))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});
 try{
  if(!await consumeLimit('login-ip:'+clientKey(request),60,300000))return NextResponse.json({error:'Слишком много попыток. Повторите позже.'},{status:429,headers:{'Retry-After':'300'}});
  const body=JSON.parse((await readBounded(request,8192)).toString());
  if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>256)return NextResponse.json({error:'Неверный email или пароль'},{status:401});
  const email=body.email.trim().toLowerCase();
  if(!await consumeLimit('login-pair:'+clientKey(request)+':'+email,10,300000))return NextResponse.json({error:'Слишком много попыток. Повторите позже.'},{status:429,headers:{'Retry-After':'300'}});
  const user=await prisma.user.findUnique({where:{email}});
  const valid=await verifyPassword(body.password,user?.passwordHash||await dummy);
  if(!user?.active||!valid){securityEvent('LOGIN_DENIED','login');return NextResponse.json({error:'Неверный email или пароль'},{status:401});}
  await setSessionCookie({userId:user.id,email:user.email,name:user.name,role:user.role});
  await prisma.auditLog.create({data:{userId:user.id,entityType:'auth',entityId:user.id,action:'LOGIN'}});
  return NextResponse.json({ok:true,role:user.role});
 }catch{return NextResponse.json({error:'Не удалось выполнить вход. Проверьте данные или повторите позже.'},{status:400});}
}
