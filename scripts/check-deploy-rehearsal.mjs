import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {randomBytes,scryptSync,randomUUID,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const root=path.resolve(process.argv[2]),meta=JSON.parse(fs.readFileSync(path.join(root,'rehearsal.json'),'utf8'));
if(!root.startsWith('D:\\LHL76-Rehearsals\\')||meta.applicationPort!==3020)throw Error('Wrong rehearsal');
const source=new URL(process.env.DATABASE_URL),target=new URL(source);target.port=String(meta.target.port);target.pathname='/'+meta.target.database;
if(target.port===source.port||target.pathname===source.pathname||meta.target.port!==55433)throw Error('Working database forbidden');
const db=new PrismaClient({datasourceUrl:target.href}),base='http://127.0.0.1:3020';
const report={startedAt:new Date().toISOString(),root,database:meta.target.database,checks:[],load:[]};let child;
const env={...process.env,NODE_ENV:'production',DATABASE_URL:target.href,AUTH_SECRET:randomBytes(48).toString('hex'),PUBLIC_SITE_URL:'https://lhl-76.ru',VK_API_ACCESS_TOKEN:'',RATE_LIMIT_DIR:path.join(root,'limiter'),NEXT_TELEMETRY_DISABLED:'1',TRUST_PROXY_IP:'0'};
delete env.NEXT_DIST_DIR;
const request=(p,o={})=>fetch(base+p,{...o,redirect:'manual',signal:AbortSignal.timeout(15000)});
const check=(name,ok)=>{report.checks.push({name,ok:Boolean(ok)});console.log((ok?'PASS ':'FAIL ')+name)};
const start=async()=>{child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3020','-H','127.0.0.1'],{cwd:root,env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',()=>{});for(let i=0;i<60;i++){try{if((await request('/api/ready')).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('Server not ready')};
const stop=async()=>{if(child&&!child.killed){child.kill();await new Promise(r=>child.once('exit',r))}};
const users=[];const pw=randomBytes(20).toString('hex'),salt=randomBytes(16),passwordHash=`scrypt:${salt.toString('hex')}:${scryptSync(pw,salt,64).toString('hex')}`;
const login=email=>request('/api/admin/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
try{
 await start();
 const admin=await db.user.create({data:{email:`rehearsal-${Date.now()}@audit.invalid`,name:'Temporary rehearsal',role:'SUPER_ADMIN',active:true,passwordHash}});users.push(admin.id);
 const auth=await login(admin.email);check('admin login',auth.status===200);
 const headers={Cookie:auth.headers.get('set-cookie').split(';')[0],Origin:base,'Content-Type':'application/json'};
 const uploadForm=new FormData();uploadForm.set('kind','players');
 const sharp=(await import('sharp')).default;
 const png=await sharp({create:{width:8,height:8,channels:3,background:'#cccccc'}}).png().toBuffer();
 uploadForm.set('file',new Blob([png],{type:'image/png'}),'rehearsal.png');
 const upload=await request('/api/admin/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:base},body:uploadForm});
 const uploaded=await upload.json();check('real image upload',upload.ok&&uploaded.originalUrl?.startsWith('/uploads/players/'));
 const uploadedPath=uploaded.originalUrl?path.join(root,'public',uploaded.originalUrl):null;
 const uploadedHash=uploadedPath?createHash('sha256').update(fs.readFileSync(uploadedPath)).digest('hex'):null;
 const badForm=new FormData();badForm.set('file',new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png');
 check('fake image rejected',(await request('/api/admin/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:base},body:badForm})).status===400);
 check('anonymous admin denied',(await request('/api/admin/players')).status===401);
 check('foreign origin denied',(await request('/api/admin/players',{method:'POST',headers:{...headers,Origin:'https://invalid.example'},body:'{}'})).status===403);
 const mutate=(endpoint,body,method='PATCH',extra={})=>request('/api/admin/'+endpoint,{method,headers:{...headers,...extra},body:JSON.stringify(body)});
 for(const kind of ['player','team']){
  const item=await db[kind].findFirst();const original=await(await request('/api/admin/'+kind+'?'+(kind==='player'?'id='+item.id:'slug='+item.slug),{headers})).json();
  const payload={...original,expectedUpdatedAt:original.updatedAt,...(kind==='player'?{firstName:'Проверка'}:{name:'Проверка'})};
  const responses=await Promise.all([mutate(kind,payload),mutate(kind,payload)]);check(kind+' concurrent update 200/409',responses.map(x=>x.status).sort().join(',')==='200,409');
 }
 const roster=await db.rosterEntry.findFirst({include:{player:true}});
 const body={id:roster.id,expectedUpdatedAt:roster.updatedAt.toISOString(),number:'999'};
 const rr=await Promise.all([mutate('roster',body),mutate('roster',body)]);check('roster concurrent update 200/409',rr.map(x=>x.status).sort().join(',')==='200,409');
 const current=await db.rosterEntry.findUnique({where:{id:roster.id},include:{player:true}}),category=await db.classificationCategory.findFirst({where:{active:true,id:{not:current.player.ratingCategoryId||''}}});
 if(category){const r=await mutate('roster',{id:current.id,expectedUpdatedAt:current.updatedAt.toISOString(),number:'998',categoryId:category.id,playerExpectedUpdatedAt:new Date(0).toISOString()});check('roster rating conflict rejected',r.status===409);check('roster transaction rolled back',(await db.rosterEntry.findUnique({where:{id:current.id}})).number===current.number)}
 for(const kind of ['players','teams']){
  const key=randomUUID(),payload=kind==='players'?{firstName:'Тест',lastName:'Репетиция'+Date.now()}:{name:'Репетиция'+Date.now()};
  const responses=await Promise.all([mutate(kind,payload,'POST',{'Idempotency-Key':key}),mutate(kind,payload,'POST',{'Idempotency-Key':key})]);
  const records=await Promise.all(responses.map(x=>x.json()));check(kind+' duplicate submit returns one entity',responses.every(x=>x.status===201)&&records[0].id&&records[0].id===records[1].id);
  check(kind+' changed payload same key rejected',(await mutate(kind,{...payload,city:'Changed'},'POST',{'Idempotency-Key':key})).status===409);
 }
 const player=await db.player.create({data:{firstName:'Тест',lastName:'Дисквалификация',slug:'rehearsal-suspension-'+Date.now()}}),entry=await db.rosterEntry.create({data:{playerId:player.id,teamEntryId:roster.teamEntryId}});
 const suspensionBody={rosterEntryId:entry.id,reason:'Isolated test',startsAt:'2026-10-29',matchesCount:2};
 const sr=await Promise.all([mutate('suspensions',suspensionBody,'POST'),mutate('suspensions',suspensionBody,'POST')]);check('suspension duplicate submit 201/409',sr.map(x=>x.status).sort().join(',')==='201,409');
 const suspension=await db.playerSuspension.findFirstOrThrow({where:{rosterEntryId:entry.id}});
 const sp={id:suspension.id,status:'CANCELLED',expectedUpdatedAt:suspension.updatedAt.toISOString()};const cr=await Promise.all([mutate('suspensions',sp),mutate('suspensions',sp)]);check('suspension concurrent update 200/409',cr.map(x=>x.status).sort().join(',')==='200,409');
 for(const role of ['ADMIN','SECRETARY']){
  const u=await db.user.create({data:{email:`rehearsal-${role.toLowerCase()}-${Date.now()}@audit.invalid`,name:'Temporary role test',role,active:true,passwordHash}});users.push(u.id);
  const r=await login(u.email),h={Cookie:r.headers.get('set-cookie').split(';')[0]};
  check(role+' cannot access users',(await request('/api/admin/users',{headers:h})).status===403);
  check(role+' can access matches',(await request('/api/admin/matches',{headers:h})).status===200);
  await db.user.update({where:{id:u.id},data:{role:role==='ADMIN'?'SECRETARY':'ADMIN'}});check(role+' role change revokes session',(await request('/api/admin/auth/me',{headers:h})).status===401);
 }
 await db.user.update({where:{id:admin.id},data:{passwordHash:'disabled-test-password'}});check('password change revokes session',(await request('/api/admin/auth/me',{headers})).status===401);
 for(const p of ['/','/news','/about','/documents','/venues','/media','/broadcasts','/tournaments','/laureates','/team/hctanki76','/team/hctanki76/print','/competition/2026-27/championship/lyubitel-plyus','/robots.txt','/sitemap.xml','/favicon.ico']){const r=await request(p);check('public '+p,r.status===200);if(p==='/'){const html=await r.text();check('canonical production origin',html.includes('https://lhl-76.ru')&&!/property="og:url" content="http:\/\/localhost/.test(html))}}
 const publicFile=path.join(root,'public/uploads/rehearsal-persistence.txt');fs.writeFileSync(publicFile,'test-only '+Date.now(),{flag:'wx'});const digest=createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex');
 for(let i=0;i<11;i++)await login('rehearsal-limit@audit.invalid');await stop();await start();check('limiter survives restart',(await login('rehearsal-limit@audit.invalid')).status===429);check('uploads survive restart',createHash('sha256').update(fs.readFileSync(publicFile)).digest('hex')===digest);
 for(const concurrency of [1,3,5]){
  if(uploadedPath)check('uploaded original survives restart',createHash('sha256').update(fs.readFileSync(uploadedPath)).digest('hex')===uploadedHash);
  let count=0,errors=0;const durations=[],begin=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{while(count<20&&errors<2){const index=count++,t=performance.now();try{const r=await request(index%2?'/api/public/home-matches':'/');await r.arrayBuffer();if(!r.ok)errors++}catch{errors++}durations.push(performance.now()-t)}}));
  durations.sort((a,b)=>a-b);const percentile=p=>Math.round(durations[Math.min(durations.length-1,Math.ceil(p*durations.length)-1)]);
  const rss=Number(execFileSync('powershell',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).WorkingSet64`],{encoding:'utf8'}).trim());
  const sample={concurrency,requests:count,errors,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),durationMs:Math.round(performance.now()-begin),rssBytes:rss};report.load.push(sample);console.log(JSON.stringify(sample));if(errors>=2||sample.p95>5000)break;
 }
}finally{await stop();if(users.length)await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'checks.json'),JSON.stringify(report,null,2));}
if(report.checks.some(x=>!x.ok))process.exitCode=1;
