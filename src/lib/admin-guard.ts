import {NextRequest,NextResponse} from 'next/server';
import {currentSession} from '@/lib/auth';
import {allowedAdminPath,sameOriginMutation} from '@/lib/security-policy';
import {prisma} from '@/lib/prisma';
import {readBounded} from '@/lib/request-limits';
import {invalidEditorialField} from '@/lib/editorial-url';
import {validAdminInput} from '@/lib/admin-input';
type Handler=(request:NextRequest,...args:any[])=>Promise<Response>;
let uploads=0;
/** Endpoints remain protected independently of middleware. */
export function withAdmin(handler:Handler):Handler{return async(request,...args)=>{
 let uploadSlot=false;
 try{
  const session=await currentSession();if(!session)return NextResponse.json({error:'Требуется вход в систему'},{status:401});
  if(!allowedAdminPath(session.role,request.nextUrl.pathname))return NextResponse.json({error:'Недостаточно прав'},{status:403});
  const mutation=!['GET','HEAD','OPTIONS'].includes(request.method);
  if(request.nextUrl.pathname==='/api/admin/upload'&&mutation){if(uploads>=2)return NextResponse.json({error:'Обработка файлов занята. Повторите позже.'},{status:429,headers:{'Retry-After':'5'}});uploads++;uploadSlot=true;}
  if(mutation&&!sameOriginMutation(request.headers.get('origin'),request.url,request.headers.get('sec-fetch-site'),request.headers.get('host')))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});
  let bounded=request;
  if(mutation){
   const max=request.nextUrl.pathname==='/api/admin/upload'?151*1024*1024:1024*1024;
   let bytes:Buffer;try{bytes=await readBounded(request,max);}catch{return NextResponse.json({error:'Превышен размер запроса'},{status:413});}
   if(['POST','PATCH','PUT'].includes(request.method)&&request.headers.get('content-type')?.includes('application/json')){
    let body;try{body=JSON.parse(bytes.toString())}catch{return NextResponse.json({error:'Некорректный JSON'},{status:400})}
    if(!validAdminInput(request.nextUrl.pathname,body))return NextResponse.json({error:'Проверьте типы, длину и диапазоны значений в форме.'},{status:400});
    const field=invalidEditorialField(body,request.nextUrl.pathname==='/api/admin/documents');
    if(field)return NextResponse.json({error:`Недопустимая ссылка или поле: ${field}. Используйте HTTPS или разрешённый локальный путь.`},{status:400});
   }
   bounded=new NextRequest(request.url,{method:request.method,headers:request.headers,body:new Uint8Array(bytes)});
  }
  const response=await handler(bounded,...args);
  if(mutation&&response.ok){await prisma.auditLog.create({data:{userId:session.userId,entityType:request.nextUrl.pathname.slice(11,111),entityId:'request',action:request.method}}).catch(()=>console.error('Audit write failed'));}
  response.headers.set('Cache-Control','private, no-store');return response;
 }catch(error){if(error instanceof Error&&error.name==='PlayoffConflict')return NextResponse.json({error:error.message},{status:409});if(error instanceof Error&&(error.name==='WriteConflict'||('code' in error&&['P2025','P2002','P2034'].includes(String(error.code)))))return NextResponse.json({error:'Запись уже изменена или существует. Ваш ввод остался в форме: скопируйте его и обновите страницу для сравнения.'},{status:409});console.error('Administrative request failed',error instanceof Error?error.name:'UnknownError');return NextResponse.json({error:'Не удалось выполнить запрос. Проверьте данные или повторите позже.'},{status:500});}finally{if(uploadSlot)uploads--;}
};}
