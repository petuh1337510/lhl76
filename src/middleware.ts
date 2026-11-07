import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, resolveSession } from '@/lib/auth';
import { allowedAdminPath, authSecret, sameOriginMutation } from '@/lib/security-policy';
import {securityEvent} from '@/lib/security-events';
const publicPaths=['/admin/login','/admin/setup','/api/admin/auth/login','/api/admin/auth/logout','/api/admin/auth/setup'];
export async function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path.startsWith('/api/')&&!path.startsWith('/api/admin/'))return NextResponse.next();
 const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
 const policy=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'self'","form-action 'self'",`script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV==='development'?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:","font-src 'self'","connect-src 'self'"+(process.env.NODE_ENV==='development'?' ws: wss:':''),"frame-src https://vk.com https://vkvideo.ru https://www.youtube.com https://www.youtube-nocookie.com https://rutube.ru"].join('; ');
 const headers=new Headers(request.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
 const next=()=>NextResponse.next({request:{headers}});
 const response=(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/'))?await authorize(request,next):next();
 response.headers.set('Content-Security-Policy',policy);
 // A nonce-bearing HTML response must never be reused for another request.
 if(!path.startsWith('/api/'))response.headers.set('Cache-Control','private, no-store');
 return response;
}
async function authorize(request:NextRequest,next:()=>NextResponse){
 const path=request.nextUrl.pathname;
 try{authSecret();}catch{return NextResponse.json({error:'Административный доступ недоступен: требуется настройка сервера'},{status:503});}
 if(!['GET','HEAD','OPTIONS'].includes(request.method)){
   if(!sameOriginMutation(request.headers.get('origin'),request.url,request.headers.get('sec-fetch-site'),request.headers.get('host')))return NextResponse.json({error:'Недопустимый источник запроса'},{status:403});
   const max=path==='/api/admin/upload'?151*1024*1024:1024*1024;
   if(Number(request.headers.get('content-length'))>max)return NextResponse.json({error:'Запрос слишком большой'},{status:413});
 }
 if(publicPaths.includes(path))return next();
 let session;
 try{session=await resolveSession(request.cookies.get(AUTH_COOKIE)?.value);}catch{return NextResponse.json({error:'Сервис временно недоступен'},{status:503});}
 if(!session){securityEvent('ACCESS_DENIED','administration');if(path.startsWith('/api/'))return NextResponse.json({error:'Требуется вход в систему'},{status:401});const url=new URL('/admin/login',request.url);url.searchParams.set('next',path);return NextResponse.redirect(url);}
 if(!allowedAdminPath(session.role,path)){securityEvent('ACCESS_DENIED','administration',session.userId);return path.startsWith('/api/')?NextResponse.json({error:'Недостаточно прав'},{status:403}):NextResponse.redirect(new URL('/admin',request.url));}
 return next();
}
// Uploads are independently protected by withAdmin (session, role, origin,
// bounded body, concurrency and audit). Avoid Next 15's Node middleware body
// cloning: it races the route handler and also truncates multipart bodies at 10 MB.
export const config={matcher:['/((?!api/admin/upload/?$|_next/|images/|uploads/|legacy-media/|documents/legacy/|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)'],runtime:'nodejs'};
