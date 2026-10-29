import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaClient} from '@prisma/client';
import sharp from 'sharp';
const container='lhl76-safety-20261028-191346';
const config=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
const password=config.Config.Env.find(x=>x.startsWith('POSTGRES_PASSWORD=')).slice(18);
const source=new URL(process.env.DATABASE_URL);
const url=new URL(`postgresql://audit_restore:${encodeURIComponent(password)}@127.0.0.1:55432/lhl76_safety_restored`);
if(source.pathname===url.pathname||source.port===url.port||config.Name!=='/'+container)throw new Error('Isolation assertion failed');
const db=new PrismaClient({datasourceUrl:url.href});
const secret=randomBytes(48).toString('hex');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3001','-H','127.0.0.1'],{env:{...process.env,NODE_ENV:'production',NEXT_DIST_DIR:'.next-final-readiness',DATABASE_URL:url.href,AUTH_SECRET:secret,PUBLIC_SITE_URL:'https://lhl-76.ru',VK_API_ACCESS_TOKEN:'',RATE_LIMIT_DIR:'.runtime/isolated-limits-'+Date.now(),TRUST_PROXY_IP:'0'},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',d=>{if(String(d).includes('Ready'))console.log('Isolated production server ready');});
child.stderr.on('data',d=>console.log(String(d).replace(/postgresql:\/\/[^\s]+/g,'[connection redacted]').slice(0,400)));
const base='http://127.0.0.1:3001',report={environment:{next:'15.5.28',database:'lhl76_safety_restored',port:55432,appPort:3001},checks:[],load:[]};
const users=[];
const check=(name,ok,details)=>{report.checks.push({name,ok,details});console.log(name+': '+(ok?'PASS':'FAIL'));};
const request=(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(10000),redirect:'manual'});
try{
 for(let i=0;i<60;i++){try{if((await request('/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 check('readiness',(await request('/api/ready')).status===200);
 check('anonymous API',(await request('/api/admin/users')).status===401);
 check('anonymous admin redirect',[307,308].includes((await request('/admin')).status));
 check('cross origin rejected',(await request('/api/admin/auth/login',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'})).status===403);
 const login=async(email,pw)=>request('/api/admin/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
 const missing=await login('missing@audit.invalid','incorrect');check('generic invalid credentials',missing.status===401,{status:missing.status,body:await missing.text()});console.log('Login diagnostic',report.checks.at(-1).details);
 const pw=randomBytes(24).toString('hex'),salt=randomBytes(16),hash=`scrypt:${salt.toString('hex')}:${scryptSync(pw,salt,64).toString('hex')}`;
 for(const role of ['SUPER_ADMIN','ADMIN','SECRETARY']){
  const user=await db.user.create({data:{email:`${role.toLowerCase()}-${Date.now()}@audit.invalid`,name:'Isolated security check',role,passwordHash:hash,active:true}});users.push(user.id);
  const response=await login(user.email,pw),cookie=response.headers.get('set-cookie');check(role+' login',response.status===200&&Boolean(cookie));
  check(role+' cookie flags',cookie?.includes('HttpOnly')&&cookie?.includes('Secure')&&/SameSite=lax/i.test(cookie||''));
  const headers={Cookie:cookie?.split(';')[0]||'',Origin:base,'Content-Type':'application/json'};
  const list=await request('/api/admin/users',{headers});check(role+' users permissions',list.status===(role==='SUPER_ADMIN'?200:403));
  if(role==='SUPER_ADMIN'){
   check('password hashes not returned',!(await list.text()).includes('passwordHash'));
   check('invalid user rejected',(await request('/api/admin/users',{method:'POST',headers,body:JSON.stringify({email:'invalid',role:'SUPER_ADMIN'})})).status===400);
   const match=await db.match.findFirst({select:{id:true,updatedAt:true}});
   const stale={matchId:match.id,expectedUpdatedAt:new Date(0).toISOString()};
   const rejected=await Promise.all([0,1].map(()=>request('/api/admin/match-protocol',{method:'PUT',headers,body:JSON.stringify(stale)})));
   check('repeated stale protocol rejected',rejected.every(r=>r.status===409));
   check('stale requests did not change match',(await db.match.findUnique({where:{id:match.id},select:{updatedAt:true}})).updatedAt.getTime()===match.updatedAt.getTime());
   const scheduled=await db.match.findFirst({where:{status:'SCHEDULED'},select:{id:true,updatedAt:true}});
   if(scheduled){
    const payload={matchId:scheduled.id,expectedUpdatedAt:scheduled.updatedAt.toISOString(),status:'SCHEDULED',resultType:'NORMAL',rosterEntryIds:[],goals:[],penalties:[],shootouts:[],protocolData:{},periodScores:[]};
    const concurrent=await Promise.all([0,1].map(()=>request('/api/admin/match-protocol',{method:'PUT',headers,body:JSON.stringify(payload)})));
    check('one concurrent protocol write succeeds and one conflicts',concurrent.map(r=>r.status).sort().join(',')==='200,409',concurrent.map(r=>r.status));
   }
   const form=new FormData();form.set('kind','documents');form.set('file',new Blob(['<script>alert(1)</script>'],{type:'application/pdf'}),'fake.pdf');
   check('spoofed PDF rejected',(await request('/api/admin/upload',{method:'POST',headers:{Cookie:headers.Cookie,Origin:base},body:form})).status===400);
  }
  if(role==='SECRETARY')check('secretary cannot edit team',(await request('/api/admin/team',{method:'POST',headers,body:'{}'})).status===403);
  await db.user.update({where:{id:user.id},data:{active:false}});
  check(role+' disabled session revoked',(await request('/api/admin/auth/me',{headers})).status===401);
  await db.user.update({where:{id:user.id},data:{active:true}});
  check(role+' old session remains revoked',(await request('/api/admin/auth/me',{headers})).status===401);
  const fresh=await login(user.email,pw),freshHeaders={Cookie:fresh.headers.get('set-cookie').split(';')[0]};
  await db.user.update({where:{id:user.id},data:{role:role==='SECRETARY'?'ADMIN':'SECRETARY'}});
  check(role+' changed role revokes session',(await request('/api/admin/auth/me',{headers:freshHeaders})).status===401);
  const roleLogin=await login(user.email,pw),roleHeaders={Cookie:roleLogin.headers.get('set-cookie').split(';')[0]};
  const replacementSalt=randomBytes(16);
  await db.user.update({where:{id:user.id},data:{passwordHash:`scrypt:${replacementSalt.toString('hex')}:${scryptSync(randomBytes(24),replacementSalt,64).toString('hex')}`}});
  check(role+' changed password revokes session',(await request('/api/admin/auth/me',{headers:roleHeaders})).status===401);
 }
 check('setup closed',(await request('/api/admin/auth/setup',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'})).status===409);
 const attempts=[];for(let i=0;i<11;i++)attempts.push((await login('rate-check@audit.invalid','bad')).status);check('login throttled',attempts.includes(429));
 for(const path of ['/','/news','/about','/documents','/media','/broadcasts','/venues','/teams','/tournaments','/laureates','/team/hctanki76?tab=roster','/player/egorov-artem','/competition/2026-27/championship/lyubitel-plyus','/robots.txt','/sitemap.xml','/icon.png','/apple-icon.png','/favicon.ico']){const r=await request(path);check('public '+path,r.status===200);if(path==='/sitemap.xml'){const xml=await r.text();check('sitemap origin and privacy',xml.includes('https://lhl-76.ru/')&&!xml.includes('localhost')&&!xml.includes('/admin'));}}
 const team=await db.team.findUnique({where:{slug:'hctanki76'},select:{teamPhotoUrl:true}});
 report.images=[];
 if(team?.teamPhotoUrl){
  const source='/api/public/legacy-media?source='+encodeURIComponent(team.teamPhotoUrl);
  const original=Buffer.from(await (await request(source)).arrayBuffer());const originalMeta=await sharp(original).metadata();
  for(const width of [480,1280]){
   const response=await request('/_next/image?url='+encodeURIComponent(source)+'&w='+width+'&q=75',{headers:{Accept:'image/webp'}});const bytes=Buffer.from(await response.arrayBuffer());const meta=await sharp(bytes).metadata();
   report.images.push({source:'team/hctanki76',requestedWidth:width,status:response.status,originalBytes:original.length,originalWidth:originalMeta.width,originalHeight:originalMeta.height,deliveredBytes:bytes.length,width:meta.width,height:meta.height,type:response.headers.get('content-type')});
  }
 }
 // Bounded, warmed HTTP-only test. No third-party URLs, no browser image requests.
 for(const concurrency of [1,3,5]){
  const durations=[];let count=0,errors=0;const started=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{while(count<20){const index=count++;const start=performance.now();try{const r=await request(index%2?'/api/public/home-matches':'/');await r.arrayBuffer();if(!r.ok)errors++;}catch{errors++;}durations.push(performance.now()-start);if(errors>1)break;}}));
  durations.sort((a,b)=>a-b);const percentile=p=>Math.round(durations[Math.min(durations.length-1,Math.ceil(p*durations.length)-1)]);
  const memory=Number(execFileSync('powershell',['-NoProfile','-Command',`(Get-Process -Id ${child.pid}).WorkingSet64`],{encoding:'utf8'}).trim());
  const result={concurrency,requests:durations.length,errors,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),elapsedMs:Math.round(performance.now()-started),serverRssBytes:memory};report.load.push(result);console.log(JSON.stringify(result));
  if(errors>1||result.p95>5000)break;
 }
}finally{
 if(users.length)await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 child.kill();report.finishedAt=new Date().toISOString();writeFileSync('artifacts/final-readiness/isolated-checks.json',JSON.stringify(report,null,2));
}
if(report.checks.some(x=>!x.ok))process.exitCode=1;
